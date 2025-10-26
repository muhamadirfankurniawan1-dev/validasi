import type { ValidationResult, PathAttachment, EndpointData } from '../utils/apicParser';

interface MatrixTableProps {
  allEntries: Array<{
    vlan: string;
    epgName: string;
    results: ValidationResult[];
    endpointData: EndpointData;
  }>;
  pathAttachments: PathAttachment[];
}

interface PathRow {
  ip: string;
  interface: string;
  vlans: Map<string, 'allowed' | 'not_allowed'>;
}

export default function MatrixTable({ allEntries, pathAttachments }: MatrixTableProps) {
  // Collect all unique VLANs
  const allVlans = Array.from(new Set(allEntries.map(e => e.vlan))).sort((a, b) => parseInt(a) - parseInt(b));

  // Build rows with IP and interface separated
  const pathRowsMap = new Map<string, PathRow>();

  allEntries.forEach(entry => {
    // Get IP from endpoint data, fallback to EPG name if not available
    let ip = entry.endpointData.ip;

    if (!ip) {
      const ipMatch = entry.epgName.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (ipMatch) {
        ip = ipMatch[1];
      }
    }

    entry.results.forEach(result => {
      // Use combination of IP and path as unique key
      const pathKey = `${ip}|${result.path}`;

      if (!pathRowsMap.has(pathKey)) {
        pathRowsMap.set(pathKey, {
          ip: ip,
          interface: result.path,
          vlans: new Map()
        });
      }

      // Set status for this VLAN
      pathRowsMap.get(pathKey)!.vlans.set(entry.vlan, result.status);
    });
  });

  const pathRows = Array.from(pathRowsMap.values()).sort((a, b) => {
    // Sort by IP first, then by interface
    if (a.ip && b.ip) {
      const ipCompare = a.ip.localeCompare(b.ip, undefined, { numeric: true });
      if (ipCompare !== 0) return ipCompare;
    }
    return a.interface.localeCompare(b.interface);
  });

  if (pathRows.length === 0 || allVlans.length === 0) {
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
              <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold sticky left-0 z-10 min-w-[120px]">
                IP
              </th>
              <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold sticky left-[120px] z-10 min-w-[100px] bg-slate-100">
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
            {pathRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-3 py-2 text-xs bg-white sticky left-0 z-10">
                  {row.ip || '-'}
                </td>
                <td className="border border-slate-300 px-3 py-2 font-mono text-xs bg-white sticky left-[120px] z-10">
                  {row.interface}
                </td>
                {allVlans.map(vlan => {
                  const status = row.vlans.get(vlan);

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
            ))}
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
