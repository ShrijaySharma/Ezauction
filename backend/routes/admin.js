import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Get auction state
router.get('/auction-state', (req, res) => {
  const db = req.app.locals.db;

  db.get('SELECT * FROM auction_state WHERE id = 1', (err, state) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!state) {
      // Initialize if not exists
      db.run('INSERT INTO auction_state (id, status) VALUES (1, ?)', ['STOPPED'], function () {
        res.json({
          status: 'STOPPED',
          currentPlayerId: null,
          biddingLocked: false,
          bidIncrements: { increment1: 500, increment2: 1000, increment3: 5000 }
        });
      });
    } else {
      res.json({
        status: state.status,
        currentPlayerId: state.current_player_id,
        biddingLocked: state.bidding_locked === 1,
        bidIncrements: {
          increment1: state.bid_increment_1,
          increment2: state.bid_increment_2,
          increment3: state.bid_increment_3
        },
        maxPlayersPerTeam: state.max_players_per_team || 10,
        enforceMaxBid: state.enforce_max_bid === 1
      });
    }
  });
});

// Update enforce max bid setting
router.post('/enforce-max-bid', (req, res) => {
  const { enforceMaxBid } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.run(
    'UPDATE auction_state SET enforce_max_bid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
    [enforceMaxBid ? 1 : 0],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      io.emit('enforce-max-bid-changed', { enforceMaxBid });
      res.json({ success: true, enforceMaxBid });
    }
  );
});

// Delete all players and bids permanently
router.delete('/players-all', (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.serialize(() => {
    db.run('DELETE FROM bids');
    db.run('DELETE FROM players');
    db.run('UPDATE auction_state SET current_player_id = NULL, status = "STOPPED"', (err) => {
      if (err) {
        return res.status(500).json({ error: 'Database error clearing players' });
      }
      io.emit('all-players-deleted');
      res.json({ success: true, message: 'All players and bids deleted permanently' });
    });
  });
});

// Update auction status
router.post('/auction-status', (req, res) => {
  const { status } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  if (!['STOPPED', 'LIVE', 'PAUSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.run(
    'UPDATE auction_state SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
    [status],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      io.emit('auction-status-changed', { status });
      res.json({ success: true, status });
    }
  );
});

// Load next player
router.post('/load-player', (req, res) => {
  const { playerId } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, player) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Update auction state
    db.run(
      'UPDATE auction_state SET current_player_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [playerId, 'LIVE'],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Clear bids for this player
        db.run('DELETE FROM bids WHERE player_id = ?', [playerId], () => {
          io.emit('player-loaded', { player });
          res.json({ success: true, player });
        });
      }
    );
  });
});

// Get current highest bid
router.get('/current-bid', (req, res) => {
  const db = req.app.locals.db;

  db.get('SELECT current_player_id FROM auction_state WHERE id = 1', (err, state) => {
    if (err || !state || !state.current_player_id) {
      return res.json({ highestBid: null, player: null });
    }

    db.get(
      `SELECT b.*, t.name as team_name, t.id as team_id, p.base_price
       FROM bids b
       JOIN teams t ON b.team_id = t.id
       JOIN players p ON b.player_id = p.id
       WHERE b.player_id = ?
       ORDER BY b.amount DESC
       LIMIT 1`,
      [state.current_player_id],
      (err, bid) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        db.get('SELECT * FROM players WHERE id = ?', [state.current_player_id], (err, player) => {
          res.json({
            highestBid: bid || null,
            player: player || null,
            currentBid: bid ? bid.amount : (player ? player.base_price : 0)
          });
        });
      }
    );
  });
});

// Get all bids for current player
router.get('/bids', (req, res) => {
  const db = req.app.locals.db;

  db.get('SELECT current_player_id FROM auction_state WHERE id = 1', (err, state) => {
    if (err || !state || !state.current_player_id) {
      return res.json({ bids: [] });
    }

    db.all(
      `SELECT b.*, t.name as team_name
       FROM bids b
       JOIN teams t ON b.team_id = t.id
       WHERE b.player_id = ?
       ORDER BY b.amount DESC, b.timestamp DESC`,
      [state.current_player_id],
      (err, bids) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ bids });
      }
    );
  });
});

// Undo last bid
router.post('/undo-bid', (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.get('SELECT current_player_id FROM auction_state WHERE id = 1', (err, state) => {
    if (err || !state || !state.current_player_id) {
      return res.status(400).json({ error: 'No active player' });
    }

    db.get(
      'SELECT * FROM bids WHERE player_id = ? ORDER BY timestamp DESC LIMIT 1',
      [state.current_player_id],
      (err, lastBid) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!lastBid) {
          return res.status(400).json({ error: 'No bids to undo' });
        }

        db.run('DELETE FROM bids WHERE id = ?', [lastBid.id], function (err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Get new highest bid
          db.get(
            `SELECT b.*, t.name as team_name
             FROM bids b
             JOIN teams t ON b.team_id = t.id
             WHERE b.player_id = ?
             ORDER BY b.amount DESC LIMIT 1`,
            [state.current_player_id],
            (err, newHighest) => {
              io.emit('bid-updated', {
                highestBid: newHighest,
                playerId: state.current_player_id
              });
              res.json({ success: true, highestBid: newHighest });
            }
          );
        });
      }
    );
  });
});

// Lock/unlock bidding
router.post('/lock-bidding', (req, res) => {
  const { locked } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.run(
    'UPDATE auction_state SET bidding_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
    [locked ? 1 : 0],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      io.emit('bidding-locked', { locked });
      res.json({ success: true, locked });
    }
  );
});

// Get max players per team
router.get('/max-players', (req, res) => {
  const db = req.app.locals.db;

  db.get('SELECT max_players_per_team FROM auction_state WHERE id = 1', (err, state) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ maxPlayersPerTeam: state?.max_players_per_team || 10 });
  });
});

// Update max players per team
router.post('/max-players', (req, res) => {
  const { maxPlayersPerTeam } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  if (!maxPlayersPerTeam || maxPlayersPerTeam < 1 || maxPlayersPerTeam > 50) {
    return res.status(400).json({ error: 'Invalid max players per team (must be between 1 and 50)' });
  }

  db.run(
    `UPDATE auction_state 
     SET max_players_per_team = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = 1`,
    [maxPlayersPerTeam],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Emit socket event to notify all clients
      io.emit('max-players-changed', { maxPlayersPerTeam });
      res.json({ success: true, maxPlayersPerTeam });
    }
  );
});

// Update bid increments
router.post('/bid-increments', (req, res) => {
  const { increment1, increment2, increment3 } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.run(
    `UPDATE auction_state 
     SET bid_increment_1 = ?, bid_increment_2 = ?, bid_increment_3 = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = 1`,
    [increment1, increment2, increment3],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      io.emit('bid-increments-changed', { increment1, increment2, increment3 });
      res.json({ success: true, increments: { increment1, increment2, increment3 } });
    }
  );
});

// Mark player as sold/unsold
router.post('/mark-player', (req, res) => {
  const { playerId, status, soldPrice, soldToTeam } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  if (!['SOLD', 'UNSOLD'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // If marking as SOLD, automatically get the highest bidder
  if (status === 'SOLD') {
    // Get the highest bid for this player
    db.get(
      `SELECT b.*, t.id as team_id, t.name as team_name
       FROM bids b
       JOIN teams t ON b.team_id = t.id
       WHERE b.player_id = ?
       ORDER BY b.amount DESC
       LIMIT 1`,
      [playerId],
      (err, highestBid) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // If no bid exists, get player base price
        db.get('SELECT base_price FROM players WHERE id = ?', [playerId], (err, player) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (!player) {
            return res.status(404).json({ error: 'Player not found' });
          }

          // If no highest bid, use base price and require manual team selection
          // But for now, we'll require at least one bid to mark as SOLD
          if (!highestBid) {
            return res.status(400).json({
              error: 'No bids found for this player. Cannot mark as SOLD without a bid.'
            });
          }

          const finalSoldPrice = soldPrice || highestBid.amount;
          const finalSoldToTeam = soldToTeam || highestBid.team_id;

          // Check if team has enough budget
          db.get('SELECT budget FROM teams WHERE id = ?', [finalSoldToTeam], (err, team) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            if (!team) {
              return res.status(400).json({ error: 'Team not found' });
            }
            if (team.budget < finalSoldPrice) {
              return res.status(400).json({ error: 'Team does not have enough budget' });
            }

            // Deduct from team budget
            db.run(
              'UPDATE teams SET budget = budget - ? WHERE id = ?',
              [finalSoldPrice, finalSoldToTeam],
              function (err) {
                if (err) {
                  return res.status(500).json({ error: 'Database error updating budget' });
                }

                // Update player status and reset was_unsold flag when sold
                db.run(
                  `UPDATE players 
                   SET status = ?, sold_price = ?, sold_to_team = ?, was_unsold = 0
                   WHERE id = ?`,
                  [status, finalSoldPrice, finalSoldToTeam, playerId],
                  function (err) {
                    if (err) {
                      return res.status(500).json({ error: 'Database error' });
                    }

                    io.emit('player-marked', { playerId, status, soldPrice: finalSoldPrice, soldToTeam: finalSoldToTeam });
                    io.emit('team-budget-updated', { teamId: finalSoldToTeam });

                    // Automatically load next available player (prioritize previously unsold players)
                    db.get(
                      `SELECT * FROM players 
                       WHERE status = 'AVAILABLE' 
                       ORDER BY was_unsold ASC, RANDOM() 
                       LIMIT 1`,
                      (err, nextPlayer) => {
                        if (err) {
                          console.error('Error finding next player:', err);
                          return res.json({ success: true });
                        }

                        if (nextPlayer) {
                          // Load the next available player
                          db.run(
                            'UPDATE auction_state SET current_player_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
                            [nextPlayer.id, 'LIVE'],
                            function (err) {
                              if (err) {
                                console.error('Error updating auction state:', err);
                                return res.json({ success: true });
                              }

                              // Clear bids for the new player
                              db.run('DELETE FROM bids WHERE player_id = ?', [nextPlayer.id], () => {
                                console.log('Auto-loaded next player:', nextPlayer.name);
                                io.emit('player-loaded', { player: nextPlayer });
                                res.json({ success: true, nextPlayerLoaded: true, nextPlayer });
                              });
                            }
                          );
                        } else {
                          // No more available players, clear current player
                          db.run(
                            'UPDATE auction_state SET current_player_id = NULL, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
                            ['STOPPED'],
                            () => {
                              io.emit('player-loaded', { player: null });
                              res.json({ success: true, nextPlayerLoaded: false, message: 'No more available players' });
                            }
                          );
                        }
                      }
                    );
                  }
                );
              }
            );
          });
        });
      }
    );
    return; // Exit early since we're handling SOLD in the callback
  } else {
    // Mark as UNSOLD - set back to AVAILABLE and mark as previously unsold
    db.run(
      `UPDATE players 
       SET status = 'AVAILABLE', sold_price = ?, sold_to_team = ?, was_unsold = 1
       WHERE id = ?`,
      [null, null, playerId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        io.emit('player-marked', { playerId, status, soldPrice: null, soldToTeam: null });

        // Automatically load next available player (including previously unsold ones)
        db.get(
          `SELECT * FROM players 
           WHERE status = 'AVAILABLE' 
           ORDER BY was_unsold ASC, RANDOM() 
           LIMIT 1`,
          (err, nextPlayer) => {
            if (err) {
              console.error('Error finding next player:', err);
              return res.json({ success: true });
            }

            if (nextPlayer) {
              db.run(
                'UPDATE auction_state SET current_player_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
                [nextPlayer.id, 'LIVE'],
                function (err) {
                  if (err) {
                    console.error('Error updating auction state:', err);
                    return res.json({ success: true });
                  }

                  db.run('DELETE FROM bids WHERE player_id = ?', [nextPlayer.id], () => {
                    console.log('Auto-loaded next player:', nextPlayer.name);
                    io.emit('player-loaded', { player: nextPlayer });
                    res.json({ success: true, nextPlayerLoaded: true, nextPlayer });
                  });
                }
              );
            } else {
              db.run(
                'UPDATE auction_state SET current_player_id = NULL, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
                ['STOPPED'],
                () => {
                  io.emit('player-loaded', { player: null });
                  res.json({ success: true, nextPlayerLoaded: false, message: 'No more available players' });
                }
              );
            }
          }
        );
      }
    );
  }
});

// Reset bidding for next player
router.post('/reset-bidding', (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.get('SELECT current_player_id FROM auction_state WHERE id = 1', (err, state) => {
    if (err || !state || !state.current_player_id) {
      return res.status(400).json({ error: 'No active player' });
    }

    db.run('DELETE FROM bids WHERE player_id = ?', [state.current_player_id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      io.emit('bidding-reset', { playerId: state.current_player_id });
      res.json({ success: true });
    });
  });
});

// Reset unsold tag for a player
router.post('/reset-unsold-tag/:playerId', (req, res) => {
  const { playerId } = req.params;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  db.run(
    `UPDATE players 
     SET was_unsold = 0
     WHERE id = ?`,
    [playerId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      // Emit event to update UI
      io.emit('player-updated', { playerId });
      res.json({ success: true, message: 'Unsold tag reset successfully' });
    }
  );
});

// Get all players
router.get('/players', (req, res) => {
  const db = req.app.locals.db;

  db.all(
    `SELECT p.*, t.name as team_name 
     FROM players p 
     LEFT JOIN teams t ON p.sold_to_team = t.id 
     ORDER BY p.id`,
    (err, players) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ players });
    }
  );
});

// Get auction history
router.get('/history', (req, res) => {
  const db = req.app.locals.db;

  db.all(
    `SELECT b.*, p.name as player_name, t.name as team_name, p.base_price
     FROM bids b
     JOIN players p ON b.player_id = p.id
     JOIN teams t ON b.team_id = t.id
     ORDER BY b.timestamp DESC
     LIMIT 100`,
    (err, history) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ history });
    }
  );
});

// Upload image endpoint
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log('File uploaded:', req.file.filename, req.file.size, 'bytes');

    // Return relative path - frontend will convert to full URL based on current host
    const imageUrl = `/uploads/${req.file.filename}`;

    console.log('Image path:', imageUrl);
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process upload: ' + error.message });
  }
});

// Add new player
router.post('/players', (req, res) => {
  const { name, image, role, country, base_price, serial_number } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  if (!name || !role || !base_price) {
    return res.status(400).json({ error: 'Name, role, and base_price are required' });
  }

  // Handle serial number adjustment if provided
  const insertPlayer = (serialNum) => {
    db.run(
      `INSERT INTO players (name, image, role, country, base_price, status, serial_number) 
       VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?)`,
      [name, image || null, role, country || null, base_price, serialNum || null],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        // Get the newly created player
        db.get('SELECT * FROM players WHERE id = ?', [this.lastID], (err, player) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          console.log('Emitting player-added event:', player);
          io.emit('player-added', { player });
          res.json({ success: true, player });
        });
      }
    );
  };

  if (serial_number !== undefined && serial_number !== null && serial_number !== '') {
    const serialNum = parseInt(serial_number);

    // Check if serial number already exists
    db.get('SELECT id FROM players WHERE serial_number = ?', [serialNum], (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      if (existing) {
        // Shift all players with serial_number >= serialNum up by 1
        db.run(
          `UPDATE players SET serial_number = serial_number + 1 WHERE serial_number >= ?`,
          [serialNum],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Database error: ' + err.message });
            }
            insertPlayer(serialNum);
          }
        );
      } else {
        insertPlayer(serialNum);
      }
    });
  } else {
    insertPlayer(null);
  }
});

// Update player
router.put('/players/:id', (req, res) => {
  const { id } = req.params;
  const { name, image, role, country, base_price, status, sold_price, sold_to_team, serial_number } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  // Handle serial number adjustment if provided
  const performUpdate = () => {
    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (image !== undefined) {
      updates.push('image = ?');
      values.push(image);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (country !== undefined) {
      updates.push('country = ?');
      values.push(country);
    }
    if (base_price !== undefined) {
      updates.push('base_price = ?');
      values.push(base_price);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (sold_price !== undefined) {
      updates.push('sold_price = ?');
      values.push(sold_price);
    }
    if (sold_to_team !== undefined) {
      updates.push('sold_to_team = ?');
      values.push(sold_to_team);
    }
    if (serial_number !== undefined) {
      updates.push('serial_number = ?');
      values.push(serial_number !== null && serial_number !== '' ? serial_number : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    db.run(
      `UPDATE players SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        // Get updated player
        db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          console.log('Emitting player-updated event:', player);
          io.emit('player-updated', { player });
          res.json({ success: true, player });
        });
      }
    );
  };

  // If serial_number is being updated, handle automatic adjustment
  if (serial_number !== undefined) {
    // Get current player's serial number
    db.get('SELECT serial_number FROM players WHERE id = ?', [id], (err, currentPlayer) => {
      if (err) {
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      const oldSerial = currentPlayer?.serial_number;
      const newSerial = serial_number !== null && serial_number !== '' ? parseInt(serial_number) : null;

      // If serial number is being cleared (set to null)
      if (newSerial === null) {
        if (oldSerial !== null) {
          // Shift all players with serial_number > oldSerial down by 1
          db.run(
            `UPDATE players SET serial_number = serial_number - 1 WHERE serial_number > ?`,
            [oldSerial],
            (err) => {
              if (err) {
                return res.status(500).json({ error: 'Database error: ' + err.message });
              }
              performUpdate();
            }
          );
        } else {
          performUpdate();
        }
      } else {
        // Check if new serial number already exists (and is not the current player)
        db.get('SELECT id FROM players WHERE serial_number = ? AND id != ?', [newSerial, id], (err, existing) => {
          if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
          }

          if (oldSerial === null) {
            // Player didn't have a serial number, now getting one
            if (existing) {
              // Shift all players with serial_number >= newSerial up by 1
              db.run(
                `UPDATE players SET serial_number = serial_number + 1 WHERE serial_number >= ?`,
                [newSerial],
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: 'Database error: ' + err.message });
                  }
                  performUpdate();
                }
              );
            } else {
              performUpdate();
            }
          } else if (oldSerial === newSerial) {
            // No change needed
            performUpdate();
          } else if (newSerial > oldSerial) {
            // Moving to a higher number: shift players between oldSerial+1 and newSerial down by 1
            db.run(
              `UPDATE players SET serial_number = serial_number - 1 WHERE serial_number > ? AND serial_number <= ? AND id != ?`,
              [oldSerial, newSerial, id],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error: ' + err.message });
                }
                performUpdate();
              }
            );
          } else {
            // Moving to a lower number: shift players between newSerial and oldSerial-1 up by 1
            db.run(
              `UPDATE players SET serial_number = serial_number + 1 WHERE serial_number >= ? AND serial_number < ? AND id != ?`,
              [newSerial, oldSerial, id],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error: ' + err.message });
                }
                performUpdate();
              }
            );
          }
        });
      }
    });
  } else {
    performUpdate();
  }
});

// Delete player
router.delete('/players/:id', (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  // Check if player is currently being auctioned
  db.get('SELECT current_player_id FROM auction_state WHERE id = 1', (err, state) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (state && state.current_player_id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete player that is currently being auctioned' });
    }

    // Delete all bids for this player first
    db.run('DELETE FROM bids WHERE player_id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Delete the player
      db.run('DELETE FROM players WHERE id = ?', [id], function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        io.emit('player-deleted', { playerId: parseInt(id) });
        res.json({ success: true });
      });
    });
  });
});

// Get all teams
router.get('/teams', (req, res) => {
  const db = req.app.locals.db;

  db.all(
    `SELECT t.*, u.username as owner_username 
     FROM teams t 
     LEFT JOIN users u ON t.owner_id = u.id 
     ORDER BY t.name`,
    (err, teams) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      // Convert bidding_locked to boolean for easier frontend handling
      const teamsWithLockStatus = teams.map(team => ({
        ...team,
        bidding_locked: team.bidding_locked === 1
      }));
      res.json(teamsWithLockStatus);
    }
  );
});

// Add new team
router.post('/teams', upload.single('logo'), (req, res) => {
  try {
    console.log('Team creation request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? req.file.filename : 'No file');

    const { name, owner_name, budget } = req.body;
    const db = req.app.locals.db;
    const io = req.app.locals.io;

    // Only team name is required
    if (!name || !name.trim()) {
      console.log('Validation failed: Team name is required');
      return res.status(400).json({ error: 'Team name is required' });
    }

    const logoPath = req.file ? `/uploads/${req.file.filename}` : null;
    const ownerName = owner_name && owner_name.trim() ? owner_name.trim() : null;
    const teamBudget = budget && budget.toString().trim() ? parseFloat(budget) : 1000000;

    // Validate budget if provided
    if (budget && budget.toString().trim() && (isNaN(teamBudget) || teamBudget < 0)) {
      console.log('Validation failed: Invalid budget');
      return res.status(400).json({ error: 'Invalid budget amount' });
    }

    console.log('Inserting team:', { name: name.trim(), ownerName, logoPath, teamBudget });

    db.run(
      `INSERT INTO teams (name, owner_name, logo, budget) VALUES (?, ?, ?, ?)`,
      [name.trim(), ownerName, logoPath, teamBudget],
      function (err) {
        if (err) {
          console.error('Database error creating team:', err);
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Team name already exists' });
          }
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        console.log('Team created with ID:', this.lastID);

        // Get the created team
        db.get('SELECT * FROM teams WHERE id = ?', [this.lastID], (err, team) => {
          if (err) {
            console.error('Error fetching created team:', err);
            return res.status(500).json({ error: 'Database error fetching team' });
          }

          console.log('Team created successfully:', team);
          io.emit('team-added', { team });
          res.json({ success: true, team });
        });
      }
    );
  } catch (error) {
    console.error('Unexpected error in team creation:', error);
    res.status(500).json({ error: 'Unexpected error: ' + error.message });
  }
});

// Update team
router.put('/teams/:id', upload.single('logo'), (req, res) => {
  const { id } = req.params;
  const { name, owner_name, budget } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (owner_name !== undefined) {
    updates.push('owner_name = ?');
    values.push(owner_name || null);
  }
  if (budget !== undefined) {
    updates.push('budget = ?');
    values.push(parseFloat(budget));
  }
  if (req.file) {
    updates.push('logo = ?');
    values.push(`/uploads/${req.file.filename}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);

  db.run(
    `UPDATE teams SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Team name already exists' });
        }
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      // Get updated team
      db.get('SELECT * FROM teams WHERE id = ?', [id], (err, team) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        io.emit('team-updated', { team });
        res.json({ success: true, team });
      });
    }
  );
});

// Delete team
router.delete('/teams/:id', (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  // Check if team has any bids or sold players
  db.get('SELECT COUNT(*) as count FROM bids WHERE team_id = ?', [id], (err, bidResult) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    db.get('SELECT COUNT(*) as count FROM players WHERE sold_to_team = ?', [id], (err, playerResult) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (bidResult.count > 0 || playerResult.count > 0) {
        return res.status(400).json({
          error: 'Cannot delete team with existing bids or sold players'
        });
      }

      // Delete associated user if exists
      db.get('SELECT owner_id FROM teams WHERE id = ?', [id], (err, team) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Delete team
        db.run('DELETE FROM teams WHERE id = ?', [id], function (err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Delete associated owner user if exists
          if (team && team.owner_id) {
            db.run('DELETE FROM users WHERE id = ?', [team.owner_id], () => { });
          }

          io.emit('team-deleted', { teamId: parseInt(id) });
          res.json({ success: true });
        });
      });
    });
  });
});

// Update team budget
router.put('/teams/:id/budget', (req, res) => {
  const { id } = req.params;
  const { budget } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  if (!budget || budget < 0) {
    return res.status(400).json({ error: 'Invalid budget amount' });
  }

  db.run(
    'UPDATE teams SET budget = ? WHERE id = ?',
    [budget, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      io.emit('team-budget-updated', { teamId: parseInt(id) });
      res.json({ success: true, budget });
    }
  );
});

// Lock/unlock team bidding
router.put('/teams/:id/lock-bidding', (req, res) => {
  const { id } = req.params;
  const { locked } = req.body;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  if (typeof locked !== 'boolean') {
    return res.status(400).json({ error: 'Invalid lock status' });
  }

  db.run(
    'UPDATE teams SET bidding_locked = ? WHERE id = ?',
    [locked ? 1 : 0, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }

      io.emit('team-bidding-locked', { teamId: parseInt(id), locked });
      res.json({ success: true, locked });
    }
  );
});

// Get players by status (for owner dashboard)
router.get('/players-by-status/:status', (req, res) => {
  const { status } = req.params;
  const db = req.app.locals.db;

  if (!['SOLD', 'AVAILABLE', 'UNSOLD'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.all(
    `SELECT p.*, t.name as team_name 
     FROM players p 
     LEFT JOIN teams t ON p.sold_to_team = t.id 
     WHERE p.status = ? 
     ORDER BY p.name`,
    [status],
    (err, players) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(players);
    }
  );
});

// Get team squads (teams with their sold players)
router.get('/team-squads', (req, res) => {
  const db = req.app.locals.db;

  // Get all teams
  db.all('SELECT * FROM teams ORDER BY name', (err, teams) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Get sold players for each team
    const teamSquadsPromises = teams.map((team) => {
      return new Promise((resolve) => {
        db.all(
          `SELECT p.* 
           FROM players p 
           WHERE p.status = 'SOLD' AND p.sold_to_team = ? 
           ORDER BY p.name`,
          [team.id],
          (err, players) => {
            if (err) {
              resolve({ team, players: [] });
            } else {
              resolve({ team, players });
            }
          }
        );
      });
    });

    Promise.all(teamSquadsPromises).then((teamSquads) => {
      res.json(teamSquads);
    });
  });
});

// Remove player from team and return to auction
router.post('/remove-player-from-team/:playerId', (req, res) => {
  const { playerId } = req.params;
  const db = req.app.locals.db;
  const io = req.app.locals.io;

  // Get player details
  db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, player) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (player.status !== 'SOLD' || !player.sold_to_team) {
      return res.status(400).json({ error: 'Player is not sold to any team' });
    }

    const teamId = player.sold_to_team;
    const soldPrice = player.sold_price || 0;

    // Refund the budget to the team
    db.run(
      'UPDATE teams SET budget = budget + ? WHERE id = ?',
      [soldPrice, teamId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error refunding budget' });
        }

        // Update player status back to AVAILABLE and mark as previously unsold
        db.run(
          `UPDATE players 
           SET status = 'AVAILABLE', sold_price = NULL, sold_to_team = NULL, was_unsold = 1
           WHERE id = ?`,
          [playerId],
          function (err) {
            if (err) {
              return res.status(500).json({ error: 'Database error updating player' });
            }

            // Get updated player
            db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, updatedPlayer) => {
              if (err) {
                return res.status(500).json({ error: 'Database error fetching updated player' });
              }

              // Emit socket events
              io.emit('player-removed-from-team', {
                playerId: parseInt(playerId),
                teamId: teamId,
                player: updatedPlayer
              });
              io.emit('team-budget-updated', { teamId: teamId });
              io.emit('player-updated', { player: updatedPlayer });

              res.json({
                success: true,
                message: 'Player removed from team and returned to auction',
                player: updatedPlayer
              });
            });
          }
        );
      }
    );
  });
});

export default router;

