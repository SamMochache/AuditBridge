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
  Info,
  Smartphone,
  Building2,
  ArrowRight,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';

// ─── Sample rows matching the real Safaricom Paybill CSV format ───────────────
const SAMPLE_ROWS = [
  ['Receipt No.', 'Completion Time', 'Details', 'Transaction Status', 'Paid In', 'Withdrawn', 'Balance'],
  ['QCV1234567', '15/01/2026 09:30:47', 'Pay Bill Online    QCV1234567 James Kamau 0712345678  Account Number NA20260001', 'Completed', '50000.00', '', '150000.00'],
  ['SKH9876543', '15/01/2026 10:15:22', 'Pay Bill Online    SKH9876543 Mary Wanjiku 0723456789  Account Number NA20260002', 'Completed', '25000.00', '', '175000.00'],
];

function rowsToCsv(rows) {
  return rows.map(r => r.map(c => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
}

function downloadSample() {
  const blob = new Blob([rowsToCsv(SAMPLE_ROWS)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mpesa_paybill_sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

const Upload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

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

  const handleFileSelect = (f) => {
    if (!f.name.endsWith('.csv')) { toast.error('Please upload a CSV file'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('File size must be less than 10 MB'); return; }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    setUploading(true);
    try {
      const response = await paymentsService.uploadCSV(file);
      setResult(response);
      toast.success('File processed successfully!');
      setFile(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Upload M-Pesa Statement</h1>
        <p className="text-navy-500 mt-1">
          Import your Safaricom Paybill statement to reconcile school fee payments
        </p>
      </div>

      {/* How it works */}
      <Card title="How it works" variant="outline">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Smartphone,
              step: '1',
              title: 'Parent pays via M-Pesa',
              desc: 'Parent dials *334# or uses the M-Pesa app, selects Pay Bill, enters the school paybill number, and types the student admission number (e.g. NA20260001) as the account reference.',
            },
            {
              icon: Building2,
              step: '2',
              title: 'School downloads statement',
              desc: 'Log into the Safaricom M-Pesa Business portal. Go to Payments → Statement → select a date range → Export as CSV. This gives you the bulk transaction file.',
            },
            {
              icon: UploadIcon,
              step: '3',
              title: 'Upload & reconcile',
              desc: 'Upload the CSV here. AuditBridge reads each row, matches the account reference to a student, and marks their fees as paid automatically.',
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="flex-shrink-0 w-9 h-9 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm">
                {step}
              </div>
              <div>
                <p className="font-semibold text-navy-900 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary-500" /> {title}
                </p>
                <p className="text-sm text-navy-500 mt-1">{desc}</p>
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
            : file     ? 'border-success-300 bg-success-50'
            :            'border-navy-200 hover:border-navy-300'
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
                <Button variant="secondary" onClick={() => { setFile(null); setResult(null); }} disabled={uploading}>
                  Clear
                </Button>
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
              {[
                { icon: File,        label: 'New Rows Imported',   value: result.summary?.created ?? 0,            color: 'from-primary-500 to-primary-600' },
                { icon: CheckCircle, label: 'Matched to Students', value: result.summary?.matched ?? 0,            color: 'from-success-500 to-success-600' },
                { icon: XCircle,     label: 'Failed to Match',     value: result.summary?.failed ?? 0,             color: 'from-error-500 to-error-600' },
                { icon: AlertCircle, label: 'Duplicates Skipped',  value: result.summary?.skipped_duplicates ?? 0, color: 'from-warning-500 to-warning-600' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-navy-50 rounded-xl p-4">
                  <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs font-medium text-navy-500">{label}</p>
                  <p className="text-2xl font-bold text-navy-900 tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {result.summary?.failed > 0 && (
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-start mb-3">
                <AlertCircle className="w-5 h-5 text-warning-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning-900">Some payments could not be matched</p>
                  <p className="text-sm text-warning-700 mt-1">
                    The most common cause is an incorrect student admission number in the M-Pesa account reference.
                    Ask the parent to confirm the number and re-submit, or manually reconcile from the Payments page.
                  </p>
                  <a href="/payments?status=FAILED" className="text-sm text-warning-700 underline hover:text-warning-800 mt-2 inline-block">
                    Review failed payments →
                  </a>
                </div>
              </div>
            )}

            {result.summary?.matched > 0 && (
              <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-start mb-3">
                <CheckCircle className="w-5 h-5 text-success-600 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-success-700">
                  <span className="font-semibold text-success-900">{result.summary.matched}</span> payment(s) matched and student fee records updated.
                </p>
              </div>
            )}

            {result.summary?.parse_errors?.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-navy-600 flex items-center gap-2">
                  <Info className="w-4 h-4 text-navy-400" />
                  {result.summary.parse_errors.length} row(s) skipped during parsing
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-navy-500 pl-6 list-disc">
                  {result.summary.parse_errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </details>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" icon={RefreshCw} onClick={() => { setFile(null); setResult(null); }}>Upload Another File</Button>
              <Button variant="ghost" onClick={() => window.location.href = '/payments'}>View All Payments</Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* CSV Format Reference */}
      <Card title="M-Pesa Paybill CSV Format" variant="outline">
        <p className="text-sm text-navy-600 mb-4">
          The file exported from the <span className="font-semibold">Safaricom M-Pesa Business portal</span> looks like this.
          The <span className="font-semibold">Account Number</span> in the Details column must match the student's
          admission number exactly as it is stored in the system.
        </p>

        <div className="overflow-x-auto rounded-lg border border-navy-200 mb-4">
          <table className="min-w-full text-xs">
            <thead className="bg-navy-50">
              <tr>
                {SAMPLE_ROWS[0].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-navy-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.slice(1).map((row, i) => (
                <tr key={i} className="border-t border-navy-100">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-navy-600 whitespace-nowrap max-w-xs truncate" title={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-3 bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4">
          <Info className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-primary-800">
            <span className="font-semibold">Key:</span> The system reads the <code className="bg-primary-100 px-1 rounded">Receipt No.</code> as the transaction code,
            extracts the student ID after <code className="bg-primary-100 px-1 rounded">Account Number</code> in the Details column,
            and uses <code className="bg-primary-100 px-1 rounded">Paid In</code> as the amount.
            Rows with a blank <em>Paid In</em> (withdrawals, charges) are automatically skipped.
          </p>
        </div>

        <Button variant="ghost" size="sm" icon={Download} onClick={downloadSample}>
          Download sample CSV
        </Button>
      </Card>
    </div>
  );
};

export default Upload;
