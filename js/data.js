/**
 * POE2 Passive Tree Data Module - CORRECT FORMAT
 * 
 * Parses the actual tree.json format with:
 * - connections: [{id, orbit}] array
 * - name: display name
 * - stats: stats array
 * - icon: path to detect keystones/notables
 */

const POE2Data = {
    version: "0.3",
    isLoaded: false,
    
    // All nodes (for pathfinding)
    allNodes: {},
    
    // Categorized nodes
    keystones: {},
    notables: {},
    smallNodes: {},
    
    // Connection graph (bidirectional)
    connections: {},
    
    // Class start nodes
    classStartNodes: {},
    
    // Nodes reachable from each class (computed after loading)
    classReachableNodes: {},
    
    // Groups for positioning
    groups: {},
    
    // Raw JSON for debugging
    rawData: null,
    
    /**
     * Clear all data
     */
    clear: function() {
        this.allNodes = {};
        this.keystones = {};
        this.notables = {};
        this.smallNodes = {};
        this.connections = {};
        this.classStartNodes = {};
        this.classReachableNodes = {};
        this.groups = {};
        this.rawData = null;
        this.isLoaded = false;
    },
    
    /**
     * Get all valuable nodes (excluding travel nodes)
     */
    getValuableNodes: function() {
        return { ...this.keystones, ...this.notables, ...this.smallNodes };
    },
    
    /**
     * Get all nodes (alias for compatibility)
     */
    getAllNodes: function() {
        return this.allNodes;
    },
    
    /**
     * Get keystones for dropdown
     */
    getKeystonesList: function() {
        return Object.values(this.keystones)
            .map(ks => ({
                id: ks.id,
                name: ks.name,
                stats: ks.stats || [],
                offense: ks.offense || 0,
                defense: ks.defense || 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    
    /**
     * Get class start node
     */
    getClassStartNode: function(className) {
        const key = className?.toLowerCase();
        if (key && this.classStartNodes[key]) {
            return this.classStartNodes[key];
        }
        
        // Return first available if requested class not found
        const available = Object.keys(this.classStartNodes);
        if (available.length > 0) {
            console.warn(`No start node for class: ${className}. Using ${available[0]} instead.`);
            return this.classStartNodes[available[0]];
        }
        
        console.error("No class start nodes available at all!");
        return null;
    },
    
    /**
     * Compute which nodes are reachable from each class (run after loading)
     */
    computeClassReachableNodes: function() {
        const allClassStarts = new Set(Object.values(this.classStartNodes));
        
        console.log("Computing class reachable nodes...");
        console.log("Class start nodes:", this.classStartNodes);
        
        // Iterate over the actual class names we have start nodes for
        Object.keys(this.classStartNodes).forEach(className => {
            const startNodeId = this.classStartNodes[className];
            if (!startNodeId) {
                console.log(`Class ${className}: NO START NODE FOUND`);
                this.classReachableNodes[className] = new Set();
                return;
            }
            
            // Check if start node has connections
            const startConnections = this.connections[startNodeId] || [];
            console.log(`Class ${className} start ${startNodeId} has ${startConnections.length} connections:`, startConnections.slice(0, 5));
            
            // BFS from class start, but DON'T cross into other class start areas
            const reachable = new Set();
            const visited = new Set();
            const queue = [startNodeId];
            
            while (queue.length > 0) {
                const nodeId = queue.shift();
                if (visited.has(nodeId)) continue;
                visited.add(nodeId);
                
                // Skip other class start nodes (don't cross into their territory)
                if (nodeId !== startNodeId && allClassStarts.has(nodeId)) {
                    continue;
                }
                
                reachable.add(nodeId);
                
                const neighbors = this.connections[nodeId] || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }
            
            this.classReachableNodes[className] = reachable;
            console.log(`Class ${className}: ${reachable.size} reachable nodes from start ${startNodeId}`);
        });
    },
    
    /**
     * Check if a node is reachable from a specific class
     */
    isNodeReachableFromClass: function(nodeId, className) {
        const reachable = this.classReachableNodes[className?.toLowerCase()];
        if (!reachable) return true; // If not computed, allow all
        return reachable.has(String(nodeId));
    },
    
    /**
     * Get all reachable nodes for a class
     */
    getReachableNodesForClass: function(className) {
        return this.classReachableNodes[className?.toLowerCase()] || new Set();
    },
    
    /**
     * Get class for ascendancy - POE2 mapping
     */
    getClassForAscendancy: function(ascendancy) {
        const asc = ascendancy?.toLowerCase();
        
        // POE2 ascendancy to class mapping
        const map = {
            // Warrior ascendancies
            'titan': 'warrior', 
            'warbringer': 'warrior',
            // Marauder ascendancies  
            'bloodmage': 'marauder', 
            'infernalist': 'marauder',
            // Ranger ascendancies
            'deadeye': 'ranger', 
            'pathfinder': 'ranger',
            // Mercenary ascendancies
            'witchhunter': 'mercenary', 
            'gemling legionnaire': 'mercenary',
            'gemlinglegionnaire': 'mercenary',
            // Sorceress ascendancies
            'chronomancer': 'sorceress', 
            'stormweaver': 'sorceress',
            // Witch ascendancies
            'blood mage': 'witch',
            'infernalist': 'witch',
            'acolyte': 'witch', 
            // Monk ascendancies
            'invoker': 'monk',
            'acolyte of chayula': 'monk',
            'chayula disciple': 'monk'
        };
        
        let className = map[asc];
        
        // If found and exists in our loaded data, return it
        if (className && this.classStartNodes[className]) {
            return className;
        }
        
        // If not found, return first available
        const available = Object.keys(this.classStartNodes);
        if (available.length > 0) {
            console.log(`No mapping for ${ascendancy}, using first available: ${available[0]}`);
            return available[0];
        }
        
        return null;
    },
    
    /**
     * Load tree.json
     */
    loadFromJSON: function(jsonData) {
        try {
            console.log("Loading tree.json...");
            console.log("Top-level keys:", Object.keys(jsonData).slice(0, 20));
            
            this.clear();
            this.rawData = jsonData;
            
            // Determine where the nodes are
            let nodes = null;
            
            if (jsonData.nodes && typeof jsonData.nodes === 'object') {
                // Nodes are under a 'nodes' key
                nodes = jsonData.nodes;
                console.log("Found nodes under 'nodes' key");
            } else {
                // Nodes are at the top level (keyed by ID)
                // Check if top-level keys look like node IDs
                const firstKey = Object.keys(jsonData)[0];
                if (firstKey && jsonData[firstKey] && typeof jsonData[firstKey] === 'object' && 
                    (jsonData[firstKey].name || jsonData[firstKey].connections)) {
                    nodes = jsonData;
                    console.log("Nodes are at top level");
                } else {
                    console.error("Could not find nodes in JSON");
                    return false;
                }
            }
            
            // Store groups if present
            if (jsonData.groups) {
                this.groups = jsonData.groups;
            }
            
            // Find class start nodes
            this.findClassStarts(jsonData, nodes);
            
            // Parse all nodes
            this.parseNodes(nodes);
            
            // Build connection graph
            this.buildConnections(nodes);
            
            // Compute which nodes are reachable from each class
            this.computeClassReachableNodes();
            
            this.isLoaded = true;
            
            console.log("=== LOAD COMPLETE ===");
            console.log(`Keystones: ${Object.keys(this.keystones).length}`);
            console.log(`Notables: ${Object.keys(this.notables).length}`);
            console.log(`Small nodes: ${Object.keys(this.smallNodes).length}`);
            console.log(`Total in allNodes: ${Object.keys(this.allNodes).length}`);
            console.log(`Class starts:`, this.classStartNodes);
            
            // Verify class start nodes exist and have connections
            Object.entries(this.classStartNodes).forEach(([classIdx, nodeId]) => {
                const exists = !!this.allNodes[nodeId];
                const connections = this.connections[nodeId] || [];
                console.log(`Class ${classIdx} start node ${nodeId}: exists=${exists}, connections=${connections.length}`, connections.slice(0, 5));
            });
            
            return true;
        } catch (e) {
            console.error("Failed to load tree:", e);
            return false;
        }
    },
    
    /**
     * Find class starting nodes
     */
    findClassStarts: function(data, nodes) {
        console.log("=== FINDING CLASS STARTS ===");
        
        // POE2 format: nodes have a "classesStart" property with array of class names
        // e.g. "47175": {"classesStart": ["Marauder", "Warrior"]}
        
        Object.keys(nodes).forEach(nodeId => {
            const node = nodes[nodeId];
            if (!node || typeof node !== 'object') return;
            
            // Check for classesStart property
            if (node.classesStart && Array.isArray(node.classesStart)) {
                node.classesStart.forEach(className => {
                    const normalizedName = className.toLowerCase();
                    this.classStartNodes[normalizedName] = String(nodeId);
                    console.log(`Found class start: ${className} -> node ${nodeId}`);
                });
            }
        });
        
        if (Object.keys(this.classStartNodes).length > 0) {
            console.log("Found class starts:", this.classStartNodes);
            return;
        }
        
        console.error("FAILED to find class starts!");
    },
    
    /**
     * Parse nodes from the actual format
     */
    parseNodes: function(nodes) {
        let keystoneCount = 0;
        let notableCount = 0;
        let smallCount = 0;
        let travelCount = 0;
        
        // DEBUG: Log first few nodes to see structure
        const nodeKeys = Object.keys(nodes).slice(0, 5);
        console.log("=== SAMPLE NODE STRUCTURES ===");
        nodeKeys.forEach(key => {
            console.log(`Node ${key}:`, JSON.stringify(nodes[key]).substring(0, 500));
        });
        
        Object.keys(nodes).forEach(nodeId => {
            // Skip non-object entries and root
            const rawNode = nodes[nodeId];
            if (!rawNode || typeof rawNode !== 'object' || nodeId === 'root') {
                return;
            }
            
            // Get basic info - handle both POE format (dn, sd) and other formats (name, stats)
            const name = rawNode.name || rawNode.dn || `Node ${nodeId}`;
            const stats = rawNode.stats || rawNode.sd || [];
            const icon = rawNode.icon || '';
            
            // Determine type - POE format uses ks (keystone) and not (notable) booleans
            let type = 'small';
            
            // Check for keystone - POE format uses 'ks: true'
            if (rawNode.ks === true || rawNode.isKeystone || /keystone/i.test(icon) || /keystone/i.test(name)) {
                type = 'keystone';
            }
            // Check for notable - POE format uses 'not: true'
            else if (rawNode.not === true || rawNode.isNotable || /notable/i.test(icon) || 
                     /Notable|Mastery|Large/i.test(icon) ||
                     this.isLikelyNotable(rawNode, stats)) {
                type = 'notable';
            }
            
            // Calculate scores
            const scores = this.calculateScores(stats, rawNode);
            
            // Extract tags
            const tags = this.extractTags(stats, icon, rawNode);
            
            // Get connections - check various property names
            let allConnections = [];
            ['out', 'connections', 'in', 'neighbours', 'linked', 'edges'].forEach(prop => {
                if (rawNode[prop] && Array.isArray(rawNode[prop])) {
                    allConnections = allConnections.concat(rawNode[prop]);
                }
            });
            const connectionIds = this.extractConnectionIds(allConnections);
            
            const node = {
                id: String(nodeId),
                name: name,
                type: type,
                stats: stats,
                tags: tags,
                offense: scores.offense,
                defense: scores.defense,
                icon: icon,
                connections: connectionIds,
                group: rawNode.group || rawNode.g,
                orbit: rawNode.orbit || rawNode.o,
                orbitIndex: rawNode.orbitIndex || rawNode.oidx,
                skill: rawNode.skill,
                // Track if this is a "valuable" node or just travel
                isTravel: stats.length === 0 && !rawNode.isAttribute && !rawNode.sa && !rawNode.da && !rawNode.ia
            };
            
            // ALWAYS add to allNodes (needed for pathfinding)
            this.allNodes[nodeId] = node;
            
            // Categorize for scoring
            if (type === 'keystone') {
                this.keystones[nodeId] = node;
                keystoneCount++;
            } else if (type === 'notable') {
                this.notables[nodeId] = node;
                notableCount++;
            } else if (stats.length > 0 || rawNode.isAttribute || rawNode.sa || rawNode.da || rawNode.ia) {
                this.smallNodes[nodeId] = node;
                smallCount++;
            } else {
                // Travel node - in allNodes but not in scoring categories
                travelCount++;
            }
        });
        
        console.log(`Parsed: ${keystoneCount} keystones, ${notableCount} notables, ${smallCount} small, ${travelCount} travel`);
    },
    
    /**
     * Extract connection IDs from various formats
     */
    extractConnectionIds: function(connections) {
        if (!connections) return [];
        
        // Handle array of {id, orbit} objects or plain numbers
        if (Array.isArray(connections)) {
            const result = connections.map(c => {
                if (typeof c === 'object' && c !== null && c.id !== undefined) {
                    return String(c.id);
                } else if (typeof c === 'number' || typeof c === 'string') {
                    return String(c);
                }
                return null;
            }).filter(id => id !== null);
            return result;
        }
        
        return [];
    },
    
    /**
     * Check if node is likely a notable (has significant stats)
     */
    isLikelyNotable: function(node, stats) {
        if (!stats || stats.length === 0) return false;
        
        // Check for high values or multiple stats
        const statText = stats.join(' ');
        const numbers = statText.match(/\d+/g) || [];
        const maxValue = Math.max(...numbers.map(n => parseInt(n)), 0);
        
        // Notable usually has values >= 20% or multiple good stats or 4+ stats
        return maxValue >= 20 || stats.length >= 4;
    },
    
    /**
     * Build bidirectional connection graph
     */
    buildConnections: function(nodes) {
        let connectionCount = 0;
        const missingNodes = new Set();
        
        // Get all class start node IDs to potentially filter cross-class connections
        const classStartSet = new Set(Object.values(this.classStartNodes));
        
        // DEBUG: Test extractConnectionIds with sample data
        console.log("=== TESTING extractConnectionIds ===");
        const testConn1 = [{"id":62677,"orbit":2147483647}];
        const testConn2 = [{"id":38003,"orbit":4},{"id":28361,"orbit":-4}];
        console.log("Test 1:", this.extractConnectionIds(testConn1));
        console.log("Test 2:", this.extractConnectionIds(testConn2));
        
        // DEBUG: Check a class start node's connections in RAW data
        console.log("=== RAW NODE CONNECTION CHECK ===");
        Object.entries(this.classStartNodes).forEach(([cls, nodeId]) => {
            const node = nodes[nodeId];
            if (node) {
                console.log(`Class start ${cls} (${nodeId}) raw connections:`, JSON.stringify(node.connections));
            } else {
                console.log(`Class start ${cls} (${nodeId}) - NODE NOT FOUND IN RAW DATA`);
            }
        });
        
        // First pass: collect all connections
        Object.keys(nodes).forEach(nodeId => {
            // SKIP the root node - it connects all class starts together
            if (nodeId === 'root') return;
            
            const rawNode = nodes[nodeId];
            if (!rawNode || typeof rawNode !== 'object') return;
            
            // POE format uses 'out' array, other formats might use 'connections' or 'in'
            // Some formats also use 'neighbours', 'linked', etc.
            let allConnections = [];
            
            // Check various property names for connections
            ['out', 'connections', 'in', 'neighbours', 'linked', 'edges'].forEach(prop => {
                if (rawNode[prop] && Array.isArray(rawNode[prop])) {
                    allConnections = allConnections.concat(rawNode[prop]);
                }
            });
            
            const connectionIds = this.extractConnectionIds(allConnections);
            
            if (!this.connections[nodeId]) {
                this.connections[nodeId] = [];
            }
            
            connectionIds.forEach(targetId => {
                // Skip connections to 'root' node
                if (targetId === 'root') return;
                
                if (!this.connections[nodeId].includes(targetId)) {
                    this.connections[nodeId].push(targetId);
                    connectionCount++;
                }
                
                // Track if target node doesn't exist
                if (!this.allNodes[targetId] && !nodes[targetId]) {
                    missingNodes.add(targetId);
                }
            });
        });
        
        console.log(`First pass: ${connectionCount} one-way connections`);
        
        // Second pass: make bidirectional
        let reverseCount = 0;
        const nodeIds = Object.keys(this.connections);
        nodeIds.forEach(nodeId => {
            const neighbors = [...this.connections[nodeId]];
            neighbors.forEach(targetId => {
                if (targetId === 'root') return; // Skip root
                
                if (!this.connections[targetId]) {
                    this.connections[targetId] = [];
                }
                if (!this.connections[targetId].includes(nodeId)) {
                    this.connections[targetId].push(nodeId);
                    reverseCount++;
                }
            });
        });
        
        console.log(`Second pass: added ${reverseCount} reverse connections`);
        
        // Create stub nodes for missing node IDs (needed for pathfinding)
        missingNodes.forEach(nodeId => {
            if (nodeId === 'root') return; // Don't create stub for root
            if (!this.allNodes[nodeId]) {
                this.allNodes[nodeId] = {
                    id: String(nodeId),
                    name: `Travel ${nodeId}`,
                    type: 'small',
                    stats: [],
                    tags: [],
                    offense: 0,
                    defense: 0,
                    isTravel: true,
                    isStub: true
                };
            }
        });
        
        // Ensure all class start nodes exist in allNodes
        Object.values(this.classStartNodes).forEach(nodeId => {
            if (!this.allNodes[nodeId]) {
                this.allNodes[nodeId] = {
                    id: String(nodeId),
                    name: `Class Start ${nodeId}`,
                    type: 'small',
                    stats: [],
                    tags: [],
                    offense: 0,
                    defense: 0,
                    isTravel: true,
                    isClassStart: true
                };
            }
            if (!this.connections[nodeId]) {
                this.connections[nodeId] = [];
            }
        });
        
        console.log(`Built ${connectionCount + reverseCount} total connections across ${Object.keys(this.connections).length} nodes`);
        console.log(`Created ${missingNodes.size} stub nodes for pathfinding`);
        
        // DEBUG: Show connections for class start nodes AFTER building
        console.log("=== CLASS START CONNECTIONS (FINAL) ===");
        Object.entries(this.classStartNodes).forEach(([cls, nodeId]) => {
            const conns = this.connections[nodeId] || [];
            console.log(`Class ${cls} start node ${nodeId} has ${conns.length} connections:`, conns.slice(0, 10));
        });
    },
    
    /**
     * Calculate offense/defense scores
     */
    calculateScores: function(stats, rawNode) {
        let offense = 0;
        let defense = 0;
        
        stats.forEach(stat => {
            const lower = stat.toLowerCase();
            const match = stat.match(/(\d+(?:\.\d+)?)/);
            const value = match ? parseFloat(match[1]) : 10;
            const mult = value / 10;
            
            // Offense
            if (/damage/i.test(lower) && !/taken/i.test(lower)) offense += mult;
            if (/attack speed|cast speed/i.test(lower)) offense += mult * 1.5;
            if (/critical/i.test(lower)) offense += mult * 1.2;
            if (/penetrate/i.test(lower)) offense += mult * 1.5;
            if (/accuracy/i.test(lower)) offense += mult * 0.5;
            
            // Defense
            if (/maximum life|% increased.*life/i.test(lower)) defense += mult * 1.5;
            if (/\+\d+.*life/i.test(lower) && !/regen/i.test(lower)) defense += mult * 0.3;
            if (/armou?r/i.test(lower)) defense += mult * 0.8;
            if (/evasion/i.test(lower)) defense += mult * 0.8;
            if (/energy shield/i.test(lower)) defense += mult;
            if (/resistance/i.test(lower)) defense += mult * 0.8;
            if (/block/i.test(lower)) defense += mult * 1.2;
            if (/life regen/i.test(lower)) defense += mult * 0.6;
            if (/reduced.*damage taken/i.test(lower)) defense += mult * 1.5;
        });
        
        return {
            offense: Math.round(offense * 10) / 10,
            defense: Math.round(defense * 10) / 10
        };
    },
    
    /**
     * Extract tags from stats and icon
     */
    extractTags: function(stats, icon, rawNode) {
        const tags = new Set();
        const text = stats.join(' ').toLowerCase();
        const iconLower = icon.toLowerCase();
        
        // Damage types
        if (/physical/i.test(text)) tags.add('physical');
        if (/fire/i.test(text) || /fire/i.test(iconLower)) tags.add('fire');
        if (/cold|freeze|chill/i.test(text) || /cold/i.test(iconLower)) tags.add('cold');
        if (/lightning|shock/i.test(text) || /lightning/i.test(iconLower)) tags.add('lightning');
        if (/chaos|poison/i.test(text)) tags.add('chaos');
        if (/elemental/i.test(text)) tags.add('elemental');
        
        // Attack/Spell
        if (/attack/i.test(text) || /attack/i.test(iconLower)) tags.add('attack');
        if (/spell/i.test(text) || /spell/i.test(iconLower)) tags.add('spell');
        if (/melee/i.test(text)) tags.add('melee');
        
        // Weapons
        if (/\bbow\b/i.test(text) || /bow/i.test(iconLower)) tags.add('bow');
        if (/crossbow/i.test(text)) tags.add('crossbow');
        if (/projectile/i.test(text) || /projectile/i.test(iconLower)) tags.add('projectile');
        if (/sword/i.test(text) || /sword/i.test(iconLower)) tags.add('sword');
        if (/axe/i.test(text) || /axe/i.test(iconLower)) tags.add('axe');
        if (/mace|sceptre/i.test(text)) tags.add('mace');
        if (/staff|stave/i.test(text)) tags.add('staff');
        if (/wand/i.test(text)) tags.add('wand');
        
        // Other
        if (/minion/i.test(text) || /minion/i.test(iconLower)) tags.add('minion');
        if (/totem/i.test(text)) tags.add('totem');
        if (/trap/i.test(text)) tags.add('trap');
        if (/critical/i.test(text)) tags.add('critical');
        if (/damage over time|burning|bleed|poison/i.test(text)) tags.add('dot');
        if (/area|radius/i.test(text)) tags.add('aoe');
        if (/life/i.test(text)) tags.add('life');
        if (/energy shield/i.test(text)) tags.add('energyshield');
        if (/armou?r/i.test(text)) tags.add('armour');
        if (/evasion/i.test(text)) tags.add('evasion');
        
        // Attributes from stats
        if (/strength/i.test(text)) tags.add('strength');
        if (/dexterity/i.test(text)) tags.add('dexterity');
        if (/intelligence/i.test(text)) tags.add('intelligence');
        
        return Array.from(tags);
    },
    
    /**
     * Get neighbors of a node
     */
    getNeighbors: function(nodeId) {
        return this.connections[String(nodeId)] || [];
    },
    
    /**
     * Find path between nodes
     */
    findPath: function(startId, endId) {
        startId = String(startId);
        endId = String(endId);
        
        if (startId === endId) return [startId];
        
        const visited = new Set();
        const queue = [[startId]];
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (visited.has(current)) continue;
            visited.add(current);
            
            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (neighbor === endId) {
                    return [...path, neighbor];
                }
                if (!visited.has(neighbor)) {
                    queue.push([...path, neighbor]);
                }
            }
        }
        
        return null;
    }
};

console.log("POE2Data module ready. Load tree.json to begin.");
