export interface EndpointData {
  vlan: string;
  ip: string;
  paths: string[];
  pod: string;
  pathsWithNodes?: Map<string, string>; // path -> node mapping
}

export interface PathAttachment {
  vlan: string;
  epg: string;
  path: string;
  fullPath: string;
  pod: string;
}

export interface ValidationResult {
  path: string;
  hasActiveEndpoint: boolean;
  isVlanAllowed: boolean;
  status: 'allowed' | 'not_allowed';
}

export function parseEndpointOutput(input: string): EndpointData | null {
  const lines = input.trim().split('\n');

  let vlan = '';
  let defaultIp = '';
  const pathSet = new Set<string>();
  const pathNodeMap = new Map<string, string>();
  const pathIPMap = new Map<string, string>();

  for (const line of lines) {
    // Skip empty lines and headers
    if (!line.trim() || line.includes('Node') && line.includes('Interface')) {
      continue;
    }

    // Extract IP address from the current line
    const ipMatch = line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    const currentLineIP = ipMatch ? ipMatch[1] : '';

    // Set default IP from first valid occurrence
    if (currentLineIP && !defaultIp) {
      defaultIp = currentLineIP;
    }

    // Extract VLAN (from either "vlan-713" or "Encap" column)
    const vlanMatch = line.match(/vlan-(\d+)/i);
    if (vlanMatch && !vlan) {
      vlan = vlanMatch[1];
    }

    // Extract Node and Interface to construct path
    // Format: Node=303, Interface=eth1/5 -> path: eth1/5
    const nodeInterfaceMatch = line.match(/(\d+)\s+(eth\d+\/\d+)\s+.*vlan-(\d+)/i);
    if (nodeInterfaceMatch) {
      const node = nodeInterfaceMatch[1];
      const interface_ = nodeInterfaceMatch[2];
      pathSet.add(interface_);
      pathNodeMap.set(interface_, node);

      // Associate this path with its IP
      if (currentLineIP) {
        pathIPMap.set(interface_, currentLineIP);
      }
    }

    // Extract VPC paths - support multiple formats
    // Format 1: vpc 425-426-VPC-31-32-PG or just 425-426-VPC-31-32-PG
    const vpcPatterns = [
      /vpc\s+([\d-]+-VPC-[\d-]+-PG)/i,
      /\b([\d]+-[\d]+-VPC-[\d]+-[\d]+-PG)\b/i,
      /([\d]+-[\d]+-VPC-[\d]+-[\d]+-PG)/i
    ];

    for (const pattern of vpcPatterns) {
      const vpcMatch = line.match(pattern);
      if (vpcMatch) {
        const vpcPath = vpcMatch[1];
        pathSet.add(vpcPath);

        // Associate this VPC path with its IP
        if (currentLineIP) {
          pathIPMap.set(vpcPath, currentLineIP);
        }
        break;
      }
    }
  }

  if (vlan && pathSet.size > 0) {
    return {
      vlan,
      ip: defaultIp,
      paths: Array.from(pathSet),
      pod: '',
      pathsWithNodes: pathNodeMap,
      pathsWithIPs: pathIPMap
    };
  }

  return null;
}

export function parseMoqueryOutput(input: string): PathAttachment[] {
  const lines = input.trim().split('\n');
  const attachments: PathAttachment[] = [];

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Match protpaths (VPC) - support patterns like 3(X)-3(X) or 425-426
    let dnMatch = line.match(/dn\s*:\s*uni\/tn-[^\/]+\/ap-[^\/]+\/epg-([^\/]+)\/rspathAtt-\[topology\/(pod-\d+)\/protpaths-([\d()X-]+)\/pathep-\[([^\]]+)\]\]/i);

    let isVpc = true;
    let protpathsIdentifier = '';

    if (dnMatch) {
      protpathsIdentifier = dnMatch[3]; // Capture the protpaths identifier (e.g., "3(X)-3(X)" or "425-426")
    }

    // Match single paths (non-VPC)
    if (!dnMatch) {
      dnMatch = line.match(/dn\s*:\s*uni\/tn-[^\/]+\/ap-[^\/]+\/epg-([^\/]+)\/rspathAtt-\[topology\/(pod-\d+)\/paths-([\d()X]+)\/pathep-\[([^\]]+)\]\]/i);
      isVpc = false;
      if (dnMatch) {
        protpathsIdentifier = dnMatch[3];
      }
    }

    if (dnMatch) {
      const epg = dnMatch[1];
      const pod = dnMatch[2];
      const pathName = isVpc ? dnMatch[4] : dnMatch[4];

      // Extract VLAN from EPG name
      const vlanMatch = epg.match(/VLAN(\d+)/i);
      const vlan = vlanMatch ? vlanMatch[1] : '';

      // Reconstruct fullPath
      let fullPath = '';
      if (isVpc) {
        fullPath = `${pod}/protpaths-${protpathsIdentifier}/pathep-[${pathName}]`;
      } else {
        fullPath = `${pod}/paths-${protpathsIdentifier}/pathep-[${pathName}]`;
      }

      if (vlan && pathName) {
        attachments.push({
          vlan,
          epg,
          path: pathName,
          fullPath,
          pod
        });
      }
    }
  }

  return attachments;
}

export function validateVlanAllowances(
  endpointData: EndpointData,
  pathAttachments: PathAttachment[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Buat Set dari path yang ada di moquery dengan VLAN yang sesuai
  const filteredAttachments = pathAttachments.filter(att => att.vlan === endpointData.vlan);
  const allowedPathsMap = new Map<string, PathAttachment>();

  filteredAttachments.forEach(att => {
    allowedPathsMap.set(normalizePathName(att.path), att);
  });

  // Validasi setiap path dari endpoint
  for (const path of endpointData.paths) {
    const normalizedPath = normalizePathName(path);
    // Path dianggap "allowed" jika ada di kedua input (endpoint DAN moquery)
    const isAllowed = allowedPathsMap.has(normalizedPath);

    results.push({
      path,
      hasActiveEndpoint: true,
      isVlanAllowed: isAllowed,
      status: isAllowed ? 'allowed' : 'not_allowed'
    });
  }

  return results;
}

// Normalisasi nama path untuk memastikan perbandingan yang konsisten
function normalizePathName(path: string): string {
  // Hapus whitespace, kurung siku, dan ubah ke lowercase untuk perbandingan
  return path.trim().replace(/[\[\]]/g, '').toLowerCase();
}

export function generateCSV(
  vlan: string,
  epg: string,
  results: ValidationResult[],
  endpointData: EndpointData,
  pathAttachments: PathAttachment[]
): string {
  const header = 'VLAN,EPG,PATH';

  const notAllowedPaths = results
    .filter(r => r.status === 'not_allowed')
    .map(r => r.path);

  // Build a map for quick lookup of moquery data
  const moqueryMap = new Map<string, PathAttachment>();
  pathAttachments.forEach(att => {
    moqueryMap.set(normalizePathName(att.path), att);
  });

  // Determine the default pod from moquery data for this VLAN
  const vlanAttachments = pathAttachments.filter(att => att.vlan === vlan);
  const defaultPod = vlanAttachments.length > 0 ? vlanAttachments[0].pod : 'pod-1';

  const rows = notAllowedPaths.map(pathName => {
    const normalizedPathName = normalizePathName(pathName);

    // First priority: Find exact match in moquery
    const moqueryData = moqueryMap.get(normalizedPathName);
    if (moqueryData) {
      // Use exact fullPath from moquery
      return `${vlan},${epg},${moqueryData.fullPath}`;
    }

    // Second priority: Find pod from any moquery entry with matching nodes
    let pod = defaultPod;

    // Try to extract nodes from path and find matching pod in moquery
    const vpcMatch = pathName.match(/([\d()X]+)-([\d()X]+)-VPC/);
    if (vpcMatch) {
      const node1 = vpcMatch[1];
      const node2 = vpcMatch[2];

      // Look for any moquery entry with same nodes to get correct pod
      for (const att of pathAttachments) {
        const attMatch = att.fullPath.match(/protpaths-([\d()X]+)-([\d()X]+)/);
        if (attMatch && attMatch[1] === node1 && attMatch[2] === node2) {
          pod = att.pod;
          break;
        }
      }

      // Construct VPC path
      return `${vlan},${epg},${pod}/protpaths-${node1}-${node2}/pathep-[${pathName}]`;
    }

    // Handle single path (non-VPC)
    const singleMatch = pathName.match(/^([\d()X]+)[-\/]/);
    if (singleMatch) {
      const node = singleMatch[1];

      // Look for any moquery entry with same node to get correct pod
      for (const att of pathAttachments) {
        const attMatch = att.fullPath.match(/paths-([\d()X]+)\//);
        if (attMatch && attMatch[1] === node) {
          pod = att.pod;
          break;
        }
      }

      return `${vlan},${epg},${pod}/paths-${node}/pathep-[${pathName}]`;
    }

    // Fallback
    return `${vlan},${epg},${pod}/paths-XXX/pathep-[${pathName}]`;
  });

  return header + '\n' + rows.join('\n');
}

export function extractPathName(path: string): string {
  return path;
}

export function extractVlanFromEpg(epgName: string): string {
  const vlanMatch = epgName.match(/VLAN(\d+)/i);
  return vlanMatch ? vlanMatch[1] : '';
}
