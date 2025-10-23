import type { ValidationResult, PathAttachment } from '../utils/apicParser';

interface MatrixTableProps {
  allEntries: Array<{
    vlan: string;
    epgName: string;
    results: ValidationResult[];
  }>;
  pathAttachments: PathAttachment[];
}

export default function MatrixTable({ allEntries, pathAttachments }: MatrixTableProps) {
  // Collect all unique VLANs
  const allVlans = Array.from(new Set(allEntries.map(e => e.vlan))).sort((a, b) => parseInt(a) - parseInt(b));

  // Collect all unique paths from all entries
  const allPathsSet = new Set<string>();
  const pathToIpMap = new Map<string, string>();

  allEntries.forEach(entry => {
    entry.results.forEach(result => {
      allPathsSet.add(result.path);

      // Try to extract IP from EPG name
      const ipMatch = entry.epgName.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (ipMatch) {
        pathToIpMap.set(result.path, ipMatch[1]);
      }
    });
  });

  const allPaths = Array.from(allPathsSet).sort();

  // Build a lookup map: path -> vlan -> status
  const statusMap = new Map<string, Map<string, 'allowed' | 'not_allowed'>>();

  allEntries.forEach(entry => {
    entry.results.forEach(result => {
      if (!statusMap.has(result.path)) {
        statusMap.set(result.path, new Map());
      }
      statusMap.get(result.path)!.set(entry.vlan, result.status);
    });
  });

  if (allPaths.length === 0 || allVlans.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <h2 className="text-xl font-bold text-slate-900 mb-4">
        VLAN Validation Matrix
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold sticky left-0 z-10">
                Interface
              </th>
              {allVlans.map(vlan => (
                <th key={vlan} className="border border-slate-300 bg-slate-100 px-3 py-2 text-center font-semibold min-w-[60px]">
                  {vlan}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPaths.map((path, idx) => {
              const ip = pathToIpMap.get(path);
              const displayPath = ip ? `${ip} ${path}` : path;

              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-3 py-2 font-mono text-xs bg-white sticky left-0 z-10">
                    {displayPath}
                  </td>
                  {allVlans.map(vlan => {
                    const status = statusMap.get(path)?.get(vlan);

                    return (
                      <td
                        key={vlan}
                        className={`border border-slate-300 px-3 py-2 text-center font-semibold ${
                          status === 'allowed'
                            ? 'bg-green-50 text-green-700'
                            : status === 'not_allowed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-white'
                        }`}
                      >
                        {status === 'allowed' ? 'OK' : status === 'not_allowed' ? 'NOK' : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 bg-green-50 border border-green-200"></div>
          <span className="text-slate-600">OK - VLAN allowed on path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 bg-red-100 border border-red-200"></div>
          <span className="text-slate-600">NOK - VLAN not allowed on path</span>
        </div>
      </div>
    </div>
  );
}
