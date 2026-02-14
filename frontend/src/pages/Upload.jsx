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
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setResult(null);
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Upload and process file
  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const response = await paymentsService.uploadCSV(file);
      
      setResult(response);
      toast.success('File uploaded and processed successfully!');
      
      // Clear file after successful upload
      setFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  // Clear selection
  const handleClear = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Upload Payments</h1>
        <p className="text-navy-500 mt-1">
          Import M-Pesa payment data from CSV files
        </p>
      </div>

      {/* Instructions */}
      <Card title="Instructions" variant="outline">
        <div className="space-y-3 text-sm text-navy-600">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold mr-3">
              1
            </div>
            <div>
              <p className="font-medium text-navy-900">Export from M-Pesa</p>
              <p>Download your paybill statement as a CSV file from the M-Pesa portal</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold mr-3">
              2
            </div>
            <div>
              <p className="font-medium text-navy-900">Upload CSV file</p>
              <p>Drag and drop your CSV file below or click to browse</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold mr-3">
              3
            </div>
            <div>
              <p className="font-medium text-navy-900">Automatic reconciliation</p>
              <p>The system will automatically match payments to students</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Upload Area */}
      <Card>
        <div
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-smooth ${
            dragActive
              ? 'border-primary-500 bg-primary-50'
              : file
              ? 'border-success-300 bg-success-50'
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
              <h3 className="text-lg font-semibold text-navy-900 mb-2">
                Drop your CSV file here
              </h3>
              <p className="text-sm text-navy-500 mb-6">
                or click to browse from your computer
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="primary" size="lg">
                Select File
              </Button>
              <p className="text-xs text-navy-400 mt-4">
                Supported format: CSV • Max size: 10MB
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-success-100 rounded-full flex items-center justify-center">
                <File className="w-8 h-8 text-success-600" />
              </div>
              <div>
                <p className="font-semibold text-navy-900">{file.name}</p>
                <p className="text-sm text-navy-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="primary"
                  onClick={handleUpload}
                  loading={uploading}
                  icon={UploadIcon}
                  size="lg"
                >
                  Upload & Process
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleClear}
                  disabled={uploading}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Upload Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card title="Processing Results" variant="default">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <ResultCard
                icon={File}
                label="Total Payments"
                value={result.summary?.total || 0}
                color="primary"
              />
              <ResultCard
                icon={CheckCircle}
                label="Successfully Matched"
                value={result.summary?.matched || 0}
                color="success"
              />
              <ResultCard
                icon={XCircle}
                label="Failed to Match"
                value={result.summary?.failed || 0}
                color="error"
              />
            </div>

            {result.summary?.failed > 0 && (
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-warning-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-warning-900">
                    Some payments could not be matched
                  </p>
                  <p className="text-sm text-warning-700 mt-1">
                    {result.summary.failed} payment(s) failed to match to students. 
                    Please review them in the Payments page.
                  </p>
                  <a
                    href="/payments?status=FAILED"
                    className="text-sm text-warning-700 underline hover:text-warning-800 mt-2 inline-block"
                  >
                    View failed payments →
                  </a>
                </div>
              </div>
            )}

            {result.summary?.matched > 0 && (
              <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-start mt-4">
                <CheckCircle className="w-5 h-5 text-success-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-success-900">
                    Successfully processed!
                  </p>
                  <p className="text-sm text-success-700 mt-1">
                    {result.summary.matched} payment(s) were successfully matched to students.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={handleClear}
              >
                Upload Another File
              </Button>
              <Button
                variant="ghost"
                icon={Download}
                onClick={() => window.location.href = '/payments'}
              >
                View All Payments
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Expected CSV Format */}
      <Card title="Expected CSV Format" variant="outline">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-navy-200">
                <th className="text-left py-3 px-4 font-semibold text-navy-900">
                  Transaction Date
                </th>
                <th className="text-left py-3 px-4 font-semibold text-navy-900">
                  Amount
                </th>
                <th className="text-left py-3 px-4 font-semibold text-navy-900">
                  Mpesa Receipt No
                </th>
                <th className="text-left py-3 px-4 font-semibold text-navy-900">
                  Account
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy-100">
                <td className="py-3 px-4 text-navy-600">2026-02-14 09:30:00</td>
                <td className="py-3 px-4 text-navy-600">50000.00</td>
                <td className="py-3 px-4 text-navy-600">SKH123456</td>
                <td className="py-3 px-4 text-navy-600">NA20260001</td>
              </tr>
              <tr className="border-b border-navy-100">
                <td className="py-3 px-4 text-navy-600">2026-02-14 10:15:00</td>
                <td className="py-3 px-4 text-navy-600">25000.00</td>
                <td className="py-3 px-4 text-navy-600">SKH123457</td>
                <td className="py-3 px-4 text-navy-600">NA20260002</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-navy-500 mt-4">
          <strong>Note:</strong> The "Account" column should contain the student admission number
        </p>
      </Card>
    </div>
  );
};

// Result Card Component
const ResultCard = ({ icon: Icon, label, value, color }) => {
  const colorClasses = {
    primary: 'from-primary-500 to-primary-600',
    success: 'from-success-500 to-success-600',
    error: 'from-error-500 to-error-600',
  };

  return (
    <div className="bg-white border border-navy-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-premium`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-sm font-medium text-navy-500">{label}</p>
      <p className="text-3xl font-bold text-navy-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
};

export default Upload;