import React, { useState } from 'react';
import * as adminService from '../services/admin';
import * as XLSX from 'xlsx';

// Simple CSV Parser
const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(','); // Simple split, doesn't handle quoted commas
        if (currentLine.length === headers.length) {
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                let value = currentLine[j].trim();
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                obj[headers[j]] = value;
            }
            result.push(obj);
        }
    }
    return result;
};

const SAMPLE_CSV = `name,role,base_price,country,serial_number,image
Virat Kohli,Batsman,20000000,India,18,
Rohit Sharma,Batsman,16000000,India,45,
Jasprit Bumrah,Bowler,12000000,India,93,
Ben Stokes,All Rounder,15000000,England,55,`;

const BulkUploadModal = ({ onClose, onSuccess }) => {
    const [csvText, setCsvText] = useState('');
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [step, setStep] = useState(1); // 1: Input, 2: Preview

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csvString = XLSX.utils.sheet_to_csv(worksheet);
                    setCsvText(csvString);
                } catch (err) {
                    setError('Error parsing file: ' + err.message);
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const handlePreview = () => {
        try {
            const parsed = parseCSV(csvText);
            if (parsed.length === 0) {
                setError('No valid data found in CSV.');
                return;
            }
            // Basic validation
            const valid = parsed.every(p => p.name && p.role && p.base_price);
            if (!valid) {
                setError('Some rows are missing required fields (name, role, base_price).');
                // We could still allow preview but show errors. For now, strict.
            }
            setPreviewData(parsed);
            setStep(2);
            setError(null);
        } catch (err) {
            setError('Error parsing CSV: ' + err.message);
        }
    };

    const handleUpload = async () => {
        setLoading(true);
        setError(null);
        try {
            // Use the parsed data from preview to ensure consistency
            const result = await adminService.addPlayersBulk(previewData);

            if (result.success) {
                alert(`Successfully added ${result.count} players!`);
                onSuccess();
                onClose();
            } else {
                setError('Upload failed: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            setError('Upload error: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const element = document.createElement('a');
        const file = new Blob([SAMPLE_CSV], { type: 'text/csv' });
        element.href = URL.createObjectURL(file);
        element.download = 'player_template.csv';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Bulk Player Upload
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Method 1: File Upload */}
                                <div className="bg-[#2a2a2a] p-6 rounded-lg border border-gray-700">
                                    <h3 className="text-lg font-semibold text-white mb-4">Option 1: Upload CSV or Excel File</h3>
                                    <p className="text-gray-400 text-sm mb-4">
                                        Upload a filed with headers: <code className="bg-black px-1 rounded">name, role, base_price, country, serial_number, image</code>
                                    </p>
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-[#333] transition-colors">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                            </svg>
                                            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-gray-500">CSV or XLSX file only</p>
                                        </div>
                                        <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
                                    </label>
                                    {file && <p className="mt-2 text-green-400 text-sm">Selected: {file.name}</p>}
                                </div>

                                {/* Method 2: Paste Text */}
                                <div className="bg-[#2a2a2a] p-6 rounded-lg border border-gray-700">
                                    <h3 className="text-lg font-semibold text-white mb-4">Option 2: Paste CSV Data</h3>
                                    <textarea
                                        className="w-full h-32 bg-black border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                                        placeholder={`name,role,base_price,country\nDhoni,WK-Batsman,20000000,India`}
                                        value={csvText}
                                        onChange={(e) => setCsvText(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={downloadTemplate}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Template
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Preview ({previewData.length} players)</h3>
                            <div className="overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg">
                                <table className="w-full text-sm text-left text-gray-400">
                                    <thead className="text-xs text-gray-200 uppercase bg-gray-800">
                                        <tr>
                                            <th className="px-6 py-3">#</th>
                                            <th className="px-6 py-3">Name</th>
                                            <th className="px-6 py-3">Role</th>
                                            <th className="px-6 py-3">Team</th>
                                            <th className="px-6 py-3">Base Price</th>
                                            <th className="px-6 py-3">Serial</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, index) => (
                                            <tr key={index} className="bg-[#2a2a2a] border-b border-gray-700 hover:bg-[#333]">
                                                <td className="px-6 py-4">{index + 1}</td>
                                                <td className="px-6 py-4 font-medium text-white">{row.name}</td>
                                                <td className="px-6 py-4">{row.role}</td>
                                                <td className="px-6 py-4">{row.country || '-'}</td>
                                                <td className="px-6 py-4">{row.base_price}</td>
                                                <td className="px-6 py-4">{row.serial_number || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-transparent hover:bg-gray-800 text-gray-300 rounded-lg transition-colors border border-gray-600"
                    >
                        Cancel
                    </button>

                    {step === 1 ? (
                        <button
                            onClick={handlePreview}
                            disabled={!csvText.trim()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg shadow-blue-900/50 font-medium"
                        >
                            Preview
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={loading}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-all shadow-lg shadow-green-900/50 font-medium flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Importing...
                                    </>
                                ) : (
                                    'Import Players'
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkUploadModal;
