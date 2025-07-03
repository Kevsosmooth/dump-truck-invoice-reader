import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CreditCard, 
  AlertCircle, 
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  FileCheck,
  Zap,
  BarChart3
} from 'lucide-react';

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.type.startsWith('image/'))) {
      setFile(droppedFile);
      uploadFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (selectedFile.type === 'application/pdf' || selectedFile.type.startsWith('image/'))) {
      setFile(selectedFile);
      uploadFile(selectedFile);
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const uploadFile = async (fileToUpload: File) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    
    setIsUploading(true);
    setLastResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/jobs/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setLastResult(result);
        console.log('Extraction successful:', result);
        
        // Create a formatted display of extracted fields
        const fields = result.extractedData;
        let extractedInfo = `✅ Document processed successfully!\n\n`;
        extractedInfo += `📄 Model Used: ${result.modelUsed}\n`;
        extractedInfo += `🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
        extractedInfo += `💳 Credits Remaining: ${result.creditsRemaining}\n\n`;
        extractedInfo += `📋 Extracted Data:\n`;
        
        // Display key fields if they exist
        Object.entries(fields).forEach(([key, value]: [string, any]) => {
          if (value?.value !== null && value?.value !== undefined && key !== '_allFields') {
            extractedInfo += `${key}: ${value.value}\n`;
          }
        });
        
        alert(extractedInfo);
      } else {
        alert(`❌ Error: ${result.error}\n\n${result.details || ''}\n\n${result.suggestion || ''}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Failed to connect to server. Make sure the backend is running on port 3001.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative bg-white/70 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Invoice AI Pro
                </h1>
                <p className="text-xs text-gray-500">Powered by Azure Document Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-full border border-emerald-200">
                <Zap className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">100 Credits</span>
              </div>
              <Button variant="outline" size="sm" className="hover:bg-gray-50 transition-colors">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Success Rate"
            value="98.5%"
            trend="+2.3%"
            color="emerald"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            title="Avg. Process Time"
            value="12s"
            trend="-3s"
            color="blue"
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            title="Documents Today"
            value="24"
            trend="+12"
            color="purple"
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Accuracy Score"
            value="99.2%"
            trend="+0.5%"
            color="pink"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-20">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      <Sparkles className="h-6 w-6" />
                      Smart Invoice Processing
                    </CardTitle>
                    <CardDescription className="text-indigo-100 mt-2">
                      Upload your invoices for instant AI-powered data extraction
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="-mt-10">
                <div
                  className={`relative bg-white rounded-2xl shadow-lg border-2 border-dashed transition-all duration-300 ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50 scale-105 shadow-2xl' 
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-xl'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="p-12 text-center">
                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDragging 
                        ? 'bg-indigo-100 scale-110' 
                        : 'bg-gradient-to-br from-indigo-50 to-purple-50'
                    }`}>
                      <Upload className={`h-10 w-10 transition-all duration-300 ${
                        isDragging ? 'text-indigo-600 scale-110' : 'text-indigo-500'
                      }`} />
                    </div>
                    <p className="mt-4 text-lg font-medium text-gray-700">
                      Drop your invoice here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or click to browse from your computer
                    </p>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={handleFileSelect}
                    />
                    <Button 
                      variant="default" 
                      size="lg" 
                      className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Select Invoice'
                      )}
                    </Button>
                    {file && (
                      <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200 animate-in slide-in-from-bottom duration-300">
                        <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {file.name} ready to process
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Alert className="mt-6 border-indigo-200 bg-indigo-50">
                  <Zap className="h-4 w-4 text-indigo-600" />
                  <AlertDescription className="text-indigo-700">
                    <strong>Free Tier Active:</strong> Process up to 2 pages per document (4MB max per page). 
                    Multi-page PDFs are automatically split for optimal processing.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Recent Jobs */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  Recent Processing Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <JobItem 
                    fileName="Q4_2024_Revenue_Report.pdf"
                    status="completed"
                    date="2 minutes ago"
                    pages={1}
                    amount="$45,230.00"
                  />
                  <JobItem 
                    fileName="Vendor_Invoice_Microsoft.pdf"
                    status="processing"
                    date="5 minutes ago"
                    pages={2}
                    progress={65}
                  />
                  <JobItem 
                    fileName="December_Expenses.pdf"
                    status="failed"
                    date="10 minutes ago"
                    pages={1}
                    error="Unable to detect invoice format"
                  />
                  <JobItem 
                    fileName="AWS_Cloud_Services.pdf"
                    status="completed"
                    date="15 minutes ago"
                    pages={3}
                    amount="$12,450.00"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Credit Balance */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Credit Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-bold mb-2">100</div>
                <p className="text-emerald-100 mb-6">
                  Process up to 100 more pages
                </p>
                <Button className="w-full bg-white text-emerald-700 hover:bg-emerald-50 font-semibold">
                  Upgrade to Pro
                </Button>
                <div className="mt-4 pt-4 border-t border-emerald-400">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-100">Next renewal</span>
                    <span className="font-medium">Feb 1, 2025</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="h-4 w-4" />
                  View All Documents
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Download className="h-4 w-4" />
                  Export Reports
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics Dashboard
                </Button>
              </CardContent>
            </Card>

            {/* AI Model Info */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI Model Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Model Version</span>
                      <span className="font-medium">v2.4.1</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Confidence Score</span>
                      <span className="font-medium text-emerald-600">98.5%</span>
                    </div>
                    <Progress value={98.5} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Fields Extracted</span>
                      <span className="font-medium">15/15</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  trend: string;
  color: 'emerald' | 'blue' | 'purple' | 'pink';
}

function StatCard({ icon, title, value, trend, color }: StatCardProps) {
  const bgColorClasses = {
    emerald: 'bg-emerald-50',
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    pink: 'bg-pink-50',
  };

  const iconColorClasses = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    pink: 'text-pink-600',
  };

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg ${bgColorClasses[color]}`}>
            <div className={iconColorClasses[color]}>
              {icon}
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {trend}
          </Badge>
        </div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  );
}

interface JobItemProps {
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  date: string;
  pages: number;
  progress?: number;
  error?: string;
  amount?: string;
}

function JobItem({ fileName, status, date, pages, progress, error, amount }: JobItemProps) {
  const statusConfig = {
    queued: { 
      label: 'Queued', 
      icon: <Clock className="h-4 w-4" />,
      color: 'text-yellow-600 bg-yellow-50 border-yellow-200'
    },
    processing: { 
      label: 'Processing', 
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    completed: { 
      label: 'Completed', 
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    failed: { 
      label: 'Failed', 
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600 bg-red-50 border-red-200'
    },
  };

  const config = statusConfig[status];

  return (
    <div className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300 bg-white">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors">
          <FileText className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{fileName}</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-500">{date}</p>
            <span className="text-xs text-gray-400">•</span>
            <p className="text-xs text-gray-500">{pages} page{pages > 1 ? 's' : ''}</p>
            {amount && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <p className="text-xs font-medium text-emerald-600">{amount}</p>
              </>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {status === 'processing' && progress && (
          <div className="w-32">
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-2" />
              <span className="text-xs text-gray-500 font-medium">{progress}%</span>
            </div>
          </div>
        )}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${config.color}`}>
          {config.icon}
          {config.label}
        </div>
        {status === 'completed' && (
          <Button size="sm" variant="ghost" className="ml-2 hover:bg-indigo-50 hover:text-indigo-600">
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default App;