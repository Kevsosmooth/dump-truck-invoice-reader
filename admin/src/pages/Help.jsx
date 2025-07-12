import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Users, 
  CreditCard, 
  FileText, 
  Settings,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

const eventCategories = [
  {
    title: 'Admin Actions',
    icon: Shield,
    color: 'from-purple-500 to-pink-600',
    events: [
      { type: 'ADMIN_LOGIN', description: 'Admin logged in', severity: 'info' },
      { type: 'ADMIN_LOGOUT', description: 'Admin logged out', severity: 'info' },
      { type: 'ADMIN_GOOGLE_LOGIN', description: 'Admin logged in via Google', severity: 'info' }
    ]
  },
  {
    title: 'User Management',
    icon: Users,
    color: 'from-blue-500 to-cyan-600',
    events: [
      { type: 'USER_CREATED', description: 'New user registered', severity: 'success' },
      { type: 'USER_UPDATED', description: 'User information updated', severity: 'info' },
      { type: 'USER_LOGIN', description: 'User logged in', severity: 'info' },
      { type: 'USER_LOGOUT', description: 'User logged out', severity: 'info' }
    ]
  },
  {
    title: 'Credit Management',
    icon: CreditCard,
    color: 'from-emerald-500 to-teal-600',
    events: [
      { type: 'CREDIT_ADJUSTMENT', description: 'Individual user credits adjusted', severity: 'warning' },
      { type: 'BULK_CREDIT_ADJUSTMENT', description: 'Multiple users credits adjusted', severity: 'warning' },
      { type: 'CREDITS_ADDED', description: 'Credits added to account', severity: 'success' },
      { type: 'CREDITS_DEDUCTED', description: 'Credits used for processing', severity: 'info' }
    ]
  },
  {
    title: 'Document Processing',
    icon: FileText,
    color: 'from-indigo-500 to-purple-600',
    events: [
      { type: 'DOCUMENT_UPLOADED', description: 'Document uploaded for processing', severity: 'info' },
      { type: 'DOCUMENT_PROCESSED', description: 'Document successfully processed', severity: 'success' },
      { type: 'document_processed', description: 'Document extraction completed', severity: 'success' },
      { type: 'document_processing_failed', description: 'Document processing failed', severity: 'error' },
      { type: 'SESSION_CREATED', description: 'New processing session started', severity: 'info' },
      { type: 'SESSION_COMPLETED', description: 'Processing session completed', severity: 'success' }
    ]
  },
  {
    title: 'Model Management',
    icon: Settings,
    color: 'from-orange-500 to-pink-600',
    events: [
      { type: 'MODELS_SYNCED', description: 'Models synchronized from Azure', severity: 'info' },
      { type: 'MODEL_CONFIGURED', description: 'New model configured', severity: 'success' },
      { type: 'MODEL_CREATED', description: 'Custom model created', severity: 'success' },
      { type: 'MODEL_UPDATED', description: 'Model settings updated', severity: 'info' },
      { type: 'MODEL_DELETED', description: 'Model removed from system', severity: 'warning' },
      { type: 'MODEL_ACCESS_GRANTED', description: 'Model access granted to user', severity: 'success' },
      { type: 'MODEL_ACCESS_UPDATED', description: 'Model permissions changed', severity: 'info' },
      { type: 'MODEL_FIELD_UPDATED', description: 'Model field configuration updated', severity: 'info' }
    ]
  }
];

function SeverityBadge({ severity }) {
  const variants = {
    info: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', icon: Info },
    success: { className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', icon: CheckCircle },
    warning: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', icon: AlertCircle },
    error: { className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: XCircle }
  };

  const variant = variants[severity] || variants.info;
  const Icon = variant.icon;

  return (
    <Badge variant="outline" className={`${variant.className} border-0 gap-1`}>
      <Icon className="h-3 w-3" />
      {severity}
    </Badge>
  );
}

export default function Help() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          Help & Documentation
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Reference guide for system events and activities
        </p>
      </div>

      {/* Activity Types Reference */}
      <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200/50 dark:border-gray-700/50">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Event Types
          </CardTitle>
          <CardDescription>
            All possible events that can appear in the Recent Activity feed
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="p-6 space-y-6">
              {eventCategories.map((category, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 bg-gradient-to-r ${category.color} rounded-lg shadow-lg`}>
                      <category.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {category.title}
                    </h3>
                  </div>
                  
                  <div className="grid gap-2 ml-11">
                    {category.events.map((event, eventIndex) => (
                      <div 
                        key={eventIndex} 
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {event.type}
                            </code>
                            <SeverityBadge severity={event.severity} />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Additional Help Sections (placeholder for future content) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Quick Start Guide</CardTitle>
            <CardDescription>Get started with the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Coming soon: Step-by-step guide for common admin tasks
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">FAQs</CardTitle>
            <CardDescription>Frequently asked questions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Coming soon: Answers to common questions
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}