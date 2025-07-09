import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileRenameBuilder } from '@/components/FileRenameBuilder';
// import { ModelTrainingPage } from '@/pages/ModelTraining';
// import { OngoingTraining } from '@/components/ModelTraining/OngoingTraining';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  BarChart3,
  Brain
} from 'lucide-react';

function App() {
  const { user, logout } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  // const [showModelTraining, setShowModelTraining] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Silvi_Reader_Full_2.0');

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf' || file.type.startsWith('image/')
    );
    
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      uploadFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf' || file.type.startsWith('image/')
    );
    
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      uploadFiles(selectedFiles);
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({current: 0, total: 0});
  const [lastResult, setLastResult] = useState(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [recentJobs, setRecentJobs] = useState([]);
  const [showRenameBuilder, setShowRenameBuilder] = useState(false);
  const [renameData, setRenameData] = useState(null);

  // Handle multiple file uploads
  const uploadFiles = async (filesToUpload) => {
    setIsUploading(true);
    setUploadProgress({ current: 0, total: filesToUpload.length });
    
    const pendingRenames = [];
    
    for (let i = 0; i < filesToUpload.length; i++) {
      setUploadProgress({ current: i + 1, total: filesToUpload.length });
      
      try {
        const result = await uploadSingleFile(filesToUpload[i]);
        
        if (result && result.needsRenaming && result.availableFields) {
          pendingRenames.push({
            availableFields: result.availableFields,
            originalFileName: result.originalFileName,
            sessionId: result.sessionId,
            result: result
          });
        }
      } catch (error) {
        console.error(`Failed to upload ${filesToUpload[i].name}:`, error);
      }
    }
    
    setIsUploading(false);
    setFiles([]);
    
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
    
    // Handle batch renaming if needed
    if (pendingRenames.length > 0) {
      // For now, show rename builder for the first file that needs it
      setRenameData(pendingRenames[0]);
      setShowRenameBuilder(true);
    }
  };

  const uploadSingleFile = async (fileToUpload) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('modelId', selectedModel);

    try {
      const response = await fetch('http://localhost:3003/api/jobs/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Extraction successful:', result);
        
        // Don't show rename builder here - handle it in uploadFiles
        if (!result.needsRenaming || !result.availableFields) {
          // Just add to recent jobs if no renaming needed
          finishProcessing(result);
        }
        
        return result;
      } else {
        alert(`❌ Error processing ${fileToUpload.name}: ${result.error}\n\n${result.details || ''}`);
        return null;
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`❌ Failed to upload ${fileToUpload.name}. Make sure the backend is running on port 3003.`);
      return null;
    }
  };

  const finishProcessing = (result, customFileName) => {
    // Add to recent jobs
    const newJob = {
      id: result.jobId,
      sessionId: result.sessionId,
      originalFileName: result.originalFileName,
      renamedFileName: customFileName || result.renamedFileName,
      status: 'completed',
      date: new Date().toISOString(),
      pages: result.pageCount,
      confidence: result.confidence,
      downloadUrl: result.downloadUrl,
      extractedData: result.extractedData,
      availableFields: result.availableFields
    };
    
    setRecentJobs(prev => [newJob, ...prev].slice(0, 10)); // Keep last 10 jobs
    
    // Show success message
    const fields = result.extractedData;
    let extractedInfo = `✅ Document processed successfully!\n\n`;
    extractedInfo += `📄 Original: ${result.originalFileName}\n`;
    extractedInfo += `📝 Renamed: ${customFileName || result.renamedFileName}\n`;
    extractedInfo += `📄 Model Used: ${result.modelUsed}\n`;
    extractedInfo += `📑 Pages Processed: ${result.pageCount}\n`;
    extractedInfo += `🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
    extractedInfo += `💳 Credits Remaining: ${result.creditsRemaining}\n\n`;
    extractedInfo += `📋 Extracted Data:\n`;
    
    // Display key fields if they exist
    if (!Array.isArray(fields)) {
      Object.entries(fields).forEach(([key, value]) => {
        if (value?.value !== null && value?.value !== undefined && key !== '_allFields') {
          extractedInfo += `${key}: ${value.value}\n`;
        }
      });
    }
    
    extractedInfo += `\n📥 Download package ready with renamed PDF and Excel!`;
    
    alert(extractedInfo);
    
    // Increment processed count
    setProcessedCount(prev => prev + 1);
  };

  const handleRename = (newFileName) => {
    setShowRenameBuilder(false);
    if (renameData && renameData.result) {
      finishProcessing(renameData.result, newFileName);
    }
    setRenameData(null);
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/jobs/export/excel');
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `processed_invoices_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`❌ ${error.error || 'Failed to export Excel file'}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export Excel file');
    }
  };

  // if (showModelTraining) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
  //       <header className="relative bg-white/70 backdrop-blur-md shadow-sm border-b border-gray-100">
  //         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  //           <div className="flex justify-between items-center h-16">
  //             <div className="flex items-center gap-3">
  //               <Button
  //                 variant="ghost"
  //                 onClick={() => setShowModelTraining(false)}
  //                 className="mr-2"
  //               >
  //                 ← Back to Dashboard
  //               </Button>
  //             </div>
  //           </div>
  //         </div>
  //       </header>
  //       <ModelTrainingPage />
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* File Rename Builder Modal */}
      {showRenameBuilder && renameData && (
        <FileRenameBuilder
          availableFields={renameData.availableFields}
          originalFileName={renameData.originalFileName}
          sessionId={renameData.sessionId}
          onRename={handleRename}
          onClose={() => {
            setShowRenameBuilder(false);
            // If closed without renaming, still finish processing with original name
            if (renameData.result) {
              finishProcessing(renameData.result);
            }
            setRenameData(null);
          }}
        />
      )}
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
                <p className="text-xs text-gray-500">AI-Powered Document Processing</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-full border border-emerald-200">
                <Zap className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">{user?.credits || 0} Credits</span>
              </div>
              <Button variant="outline" size="sm" className="hover:bg-gray-50 transition-colors" onClick={logout}>
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

        {/* Ongoing Training Section */}
        {/* <OngoingTraining /> */}

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
                      Drop your invoices here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or click to browse multiple files from your computer
                    </p>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,image/*"
                      multiple
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
                          Processing {uploadProgress.current}/{uploadProgress.total}...
                        </>
                      ) : (
                        'Select Invoices'
                      )}
                    </Button>
                    {files.length > 0 && (
                      <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200 animate-in slide-in-from-bottom duration-300">
                        <p className="text-sm font-medium text-emerald-700 flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {files.length} file{files.length > 1 ? 's' : ''} ready to process
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {files.map((f, idx) => (
                            <p key={idx} className="text-xs text-emerald-600">
                              • {f.name}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Model Selection
                    </label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Silvi_Reader_Full_2.0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                            <span>Silvi Reader Full 2.0</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="prebuilt-invoice">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Standard</Badge>
                            <span>Prebuilt Invoice</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="custom" disabled>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">Custom</Badge>
                            <span>Your Custom Models</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-gray-500">
                      Train custom models to extract specific data from your invoices
                    </p>
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
                  {recentJobs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No documents processed yet</p>
                      <p className="text-xs mt-1">Upload your first invoice to get started</p>
                    </div>
                  ) : (
                    recentJobs.map((job) => (
                      <JobItemWithDownload
                        key={job.id}
                        job={job}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upload Progress or Credit Balance */}
            {isUploading && uploadProgress.total > 1 ? (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing Files
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm font-medium">
                          {uploadProgress.current} / {uploadProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(uploadProgress.current / uploadProgress.total) * 100} 
                        className="h-3 bg-indigo-200"
                      />
                    </div>
                    <p className="text-indigo-100 text-sm">
                      Processing file {uploadProgress.current} of {uploadProgress.total}...
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Credit Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-bold mb-2">{user?.credits || 0}</div>
                  <p className="text-emerald-100 mb-6">
                    Process up to {user?.credits || 0} more pages
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
            )}

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
                {/* <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => setShowModelTraining(true)}
                >
                  <Brain className="h-4 w-4" />
                  Custom Model Training
                </Button> */}
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

function StatCard({ icon, title, value, trend, color }) {
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

function JobItem({ fileName, status, date, pages, progress, error, amount }) {
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

function JobItemWithDownload({ job }) {
  const [isDownloading, setIsDownloading] = useState(false);
  
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`http://localhost:3003${job.downloadUrl}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_package_${job.sessionId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download package');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download package');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Format the date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };
  
  // Extract amount from data if available
  let amount = null;
  if (job.extractedData && !Array.isArray(job.extractedData)) {
    const amountFields = ['InvoiceTotal', 'TotalAmount', 'Total', 'AmountDue', 'Amount'];
    for (const field of amountFields) {
      if (job.extractedData[field]?.value) {
        amount = job.extractedData[field].value;
        break;
      }
    }
  }
  
  return (
    <div className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300 bg-white">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors">
          <FileText className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{job.originalFileName}</p>
          <p className="text-xs text-gray-500 mt-0.5">→ {job.renamedFileName}</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-500">{formatDate(job.date)}</p>
            <span className="text-xs text-gray-400">•</span>
            <p className="text-xs text-gray-500">{job.pages} page{job.pages > 1 ? 's' : ''}</p>
            <span className="text-xs text-gray-400">•</span>
            <p className="text-xs text-gray-500">{(job.confidence * 100).toFixed(0)}% confidence</p>
            {amount && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <p className="text-xs font-medium text-emerald-600">{amount}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border text-emerald-600 bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Completed
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleDownload}
          disabled={isDownloading}
          className="ml-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Download className="h-4 w-4 mr-1" />
              Download ZIP
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default App;