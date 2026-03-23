async function test() {
  try {
    const res = await fetch('http://localhost:4000/api/admin/teams/1/credentials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'testuser_123',
        password: 'newpassword123'
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log("Success:", data);
    } else {
      const text = await res.text();
      console.error("API Error:", res.status, text);
    }
  } catch (err) {
    console.error("Server unreachable:", err.message);
  }
}

test();
