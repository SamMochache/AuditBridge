import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload as UploadIcon,
  File,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw,
  Copy,
  Info,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';

// ─── Sample rows for the two supported formats ────────────────────────────────
const SAFARICOM_SAMPLE = [
  ['Receipt No.', 'Completion Time', 'Details', 'Transaction Status', 'Paid In', 'Withdrawn', 'Balance'],
  ['QCV1234567', '15/01/2026 09:30:47', 'Pay Bill Online    QCV1234567 James Kamau 0712345678  Account Number NA20260001', 'Completed', '50000.00', '', '150000.00'],
  ['SKH9876543', '15/01/2026 10:15:22', 'Pay Bill Online    SKH9876543 Mary Wanjiku 0723456789  Account Number NA20260002', 'Completed', '25000.00', '', '175000.00'],
];

const SIMPLE_SAMPLE = [
  ['Transaction Date', 'Amount', 'Mpesa Receipt No', 'Account'],
  ['2026-01-15 09:30:00', '50000.00', 'QCV1234567', 'NA20260001'],
  ['2026-01-15 10:15:00', '25000.00', 'SKH9876543', 'NA20260002'],
];

function rowsToCsv(rows) {
  return rows.map(r => r.map(c => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
}

function downloadCsv(rows, filename) {
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────

const Upload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeFormat, setActiveFormat] = useState('safaricom');

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, []);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10 MB');
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    setUploading(true);
    try {
      const response = await paymentsService.uploadCSV(file);
      setResult(response);
      toast.success('File uploaded and processed successfully!');
      setFile(null);
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to upload file';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => { setFile(null); setResult(null); };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Upload Payments</h1>
        <p className="text-navy-500 mt-1">Import M-Pesa paybill payment data from CSV files</p>
      </div>

      {/* Instructions */}
      <Card title="How it works" variant="outline">
        <div className="space-y-3 text-sm text-navy-600">
          {[
            ['Export from M-Pesa Business', 'Log into the Safaricom M-Pesa Business portal and download your paybill statement as a CSV file.'],
            ['Upload your CSV', 'Drag and drop the CSV file below or click to browse.'],
            ['Automatic reconciliation', 'The system matches each payment to a student by admission number and marks fees as paid.'],
          ].map(([title, desc], i) => (
            <div key={i} className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold mr-3 text-xs">
                {i + 1}
              </div>
              <div>
                <p className="font-medium text-navy-900">{title}</p>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Drop zone */}
      <Card>
        <div
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-smooth ${
            dragActive ? 'border-primary-500 bg-primary-50'
              : file ? 'border-success-300 bg-success-50'
              : 'border-navy-200 hover:border-navy-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {!file ? (
            <>
              <UploadIcon className="w-16 h-16 mx-auto text-navy-300 mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 mb-2">Drop your CSV file here</h3>
              <p className="text-sm text-navy-500 mb-6">or click to browse from your computer</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="primary" size="lg">Select File</Button>
              <p className="text-xs text-navy-400 mt-4">CSV only · Max 10 MB</p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-success-100 rounded-full flex items-center justify-center">
                <File className="w-8 h-8 text-success-600" />
              </div>
              <div>
                <p className="font-semibold text-navy-900">{file.name}</p>
                <p className="text-sm text-navy-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="primary" onClick={handleUpload} loading={uploading} icon={UploadIcon} size="lg">
                  Upload &amp; Process
                </Button>
                <Button variant="secondary" onClick={handleClear} disabled={uploading}>Clear</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card title="Processing Results">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <ResultStat icon={File} label="New Rows Imported" value={result.summary?.created ?? 0} color="primary" />
              <ResultStat icon={CheckCircle} label="Matched" value={result.summary?.matched ?? 0} color="success" />
              <ResultStat icon={XCircle} label="Failed" value={result.summary?.failed ?? 0} color="error" />
              <ResultStat icon={AlertCircle} label="Duplicates Skipped" value={result.summary?.skipped_duplicates ?? 0} color="warning" />
            </div>

            {result.summary?.failed > 0 && (
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-start mb-4">
                <AlertCircle className="w-5 h-5 text-warning-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-warning-900">Some payments could not be matched</p>
                  <p className="text-sm text-warning-700 mt-1">
                    {result.summary.failed} payment(s) failed to match to students.
                    Common causes: incorrect student admission number in the M-Pesa account reference.
                  </p>
                  <a href="/payments?status=FAILED" className="text-sm text-warning-700 underline hover:text-warning-800 mt-2 inline-block">
                    View failed payments →
                  </a>
                </div>
              </div>
            )}

            {result.summary?.matched > 0 && (
              <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-start mb-4">
                <CheckCircle className="w-5 h-5 text-success-600 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-success-700">
                  <span className="font-medium text-success-900">{result.summary.matched}</span> payment(s) were successfully matched to student fee records.
                </p>
              </div>
            )}

            {/* Parse errors */}
            {result.summary?.parse_errors?.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-navy-700 flex items-center gap-2">
                  <Info className="w-4 h-4 text-navy-400" />
                  {result.summary.parse_errors.length} row(s) skipped during parsing (click to expand)
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-navy-600 pl-6 list-disc">
                  {result.summary.parse_errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" icon={RefreshCw} onClick={handleClear}>Upload Another File</Button>
              <Button variant="ghost" onClick={() => window.location.href = '/payments'}>View All Payments</Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Format Reference */}
      <Card title="Supported CSV Formats" variant="outline">
        {/* Format tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveFormat('safaricom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-smooth ${
              activeFormat === 'safaricom'
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-transparent text-navy-600 hover:bg-navy-50'
            }`}
          >
            Safaricom Paybill Statement
          </button>
          <button
            onClick={() => setActiveFormat('simple')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-smooth ${
              activeFormat === 'simple'
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-transparent text-navy-600 hover:bg-navy-50'
            }`}
          >
            Simple / Custom Format
          </button>
        </div>

        {activeFormat === 'safaricom' && (
          <div>
            <p className="text-sm text-navy-600 mb-3">
              This is the standard export from the{' '}
              <span className="font-medium">Safaricom M-Pesa Business portal</span>. The student
              admission number must be entered as the <em>account reference</em> when making the
              paybill payment (e.g. <code className="bg-navy-100 px-1 rounded text-xs">NA20260001</code>).
            </p>
            <div className="overflow-x-auto rounded-lg border border-navy-200">
              <table className="min-w-full text-xs">
                <thead className="bg-navy-50">
                  <tr>
                    {SAFARICOM_SAMPLE[0].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-navy-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAFARICOM_SAMPLE.slice(1).map((row, i) => (
                    <tr key={i} className="border-t border-navy-100">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-navy-600 whitespace-nowrap max-w-xs truncate" title={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-navy-500 mt-2">
              <span className="font-medium">Note:</span> The parser extracts the account reference
              from the <em>Details</em> column (after "Account Number …") and the receipt number
              from the <em>Receipt No.</em> column or the Details text.
            </p>
            <Button
              variant="ghost"
              size="sm"
              icon={Download}
              className="mt-3"
              onClick={() => downloadCsv(SAFARICOM_SAMPLE, 'mpesa_safaricom_template.csv')}
            >
              Download sample CSV
            </Button>
          </div>
        )}

        {activeFormat === 'simple' && (
          <div>
            <p className="text-sm text-navy-600 mb-3">
              A simplified format you can create manually or export from other tools.
            </p>
            <div className="overflow-x-auto rounded-lg border border-navy-200">
              <table className="min-w-full text-xs">
                <thead className="bg-navy-50">
                  <tr>
                    {SIMPLE_SAMPLE[0].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-navy-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SIMPLE_SAMPLE.slice(1).map((row, i) => (
                    <tr key={i} className="border-t border-navy-100">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-navy-600">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="text-xs text-navy-500 mt-3 space-y-1 list-disc pl-4">
              <li><span className="font-medium">Transaction Date</span> – YYYY-MM-DD HH:MM:SS or DD/MM/YYYY HH:MM</li>
              <li><span className="font-medium">Amount</span> – numeric, no currency symbol (e.g. 50000.00)</li>
              <li><span className="font-medium">Mpesa Receipt No</span> – the 10-character M-Pesa code (e.g. QCV1234567)</li>
              <li><span className="font-medium">Account</span> – student admission number exactly as stored in the system</li>
            </ul>
            <Button
              variant="ghost"
              size="sm"
              icon={Download}
              className="mt-3"
              onClick={() => downloadCsv(SIMPLE_SAMPLE, 'mpesa_simple_template.csv')}
            >
              Download sample CSV
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

// Small stat card used in results section
const ResultStat = ({ icon: Icon, label, value, color }) => {
  const bg = { primary: 'from-primary-500 to-primary-600', success: 'from-success-500 to-success-600', error: 'from-error-500 to-error-600', warning: 'from-warning-500 to-warning-600' };
  return (
    <div className="bg-white border border-navy-200 rounded-lg p-4">
      <div className={`w-9 h-9 bg-gradient-to-br ${bg[color]} rounded-lg flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs font-medium text-navy-500">{label}</p>
      <p className="text-2xl font-bold text-navy-900 tabular-nums">{value}</p>
    </div>
  );
};

export default Upload;
