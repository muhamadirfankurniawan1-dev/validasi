import { CheckCircle, XCircle } from 'lucide-react';
import type { ValidationResult } from '../utils/apicParser';
import { extractPathName } from '../utils/apicParser';

interface ValidationTableProps {
  results: ValidationResult[];
  vlan: string;
}

export default function ValidationTable({ results, vlan }: ValidationTableProps) {
  const allowedCount = results.filter(r => r.status === 'allowed').length;
  const notAllowedCount = results.filter(r => r.status === 'not_allowed').length;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-900">
            {allowedCount} Allowed
          </span>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm font-medium text-red-900">
            {notAllowedCount} Not Allowed
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  VPC Path
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Active Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  VLAN {vlan} Allowed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.map((result, index) => (
                <tr
                  key={index}
                  className={result.status === 'not_allowed' ? 'bg-red-50' : 'bg-white'}
                >
                  <td className="px-6 py-4 text-sm font-mono text-slate-900">
                    {extractPathName(result.path)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-slate-700">Yes</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {result.isVlanAllowed ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-slate-700">Yes</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-slate-700">No</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {result.status === 'allowed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        Not Allowed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
