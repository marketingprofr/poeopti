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
        const classMap = {
            'warrior': 0,
            'marauder': 1,
            'ranger': 2,
            'mercenary': 3,
            'sorceress': 4,
            'witch': 5,
            'monk': 6
        };
        
        const idx = classMap[className?.toLowerCase()];
        if (idx !== undefined && this.classStartNodes[idx]) {
            return this.classStartNodes[idx];
        }
        
        // Return first available
        const starts = Object.values(this.classStartNodes);
        return starts.length > 0 ? starts[0] : null;
    },
    
    /**
     * Get class for ascendancy
     */
    getClassForAscendancy: function(ascendancy) {
        const map = {
            'titan': 'warrior', 'warbringer': 'warrior',
            'bloodmage': 'marauder', 'infernalist': 'marauder',
            'deadeye': 'ranger', 'pathfinder': 'ranger',
            'witchhunter': 'mercenary', 'gemlinglegionnaire': 'mercenary',
            'chronomancer': 'sorceress', 'stormweaver': 'sorceress',
            'acolyte': 'witch', 'invoker': 'witch',
            'chayuladisciple': 'monk', 'invokermonk': 'monk'
        };
        return map[ascendancy?.toLowerCase()] || null;
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
        // Try different possible locations
        
        // 1. Check for classes array
        if (data.classes && Array.isArray(data.classes)) {
            data.classes.forEach((cls, idx) => {
                if (cls.startNode) {
                    this.classStartNodes[idx] = String(cls.startNode);
                }
            });
            if (Object.keys(this.classStartNodes).length > 0) {
                console.log("Found class starts from classes array");
                return;
            }
        }
        
        // 2. Check for root node with out array (and set up connections)
        if (data.root && data.root.out && Array.isArray(data.root.out)) {
            data.root.out.forEach((nodeId, idx) => {
                const nodeIdStr = String(nodeId);
                this.classStartNodes[idx] = nodeIdStr;
                
                // IMPORTANT: Make sure root connects to class starts
                // The root node acts as a virtual center connecting all class starts
                if (!this.connections['root']) {
                    this.connections['root'] = [];
                }
                this.connections['root'].push(nodeIdStr);
            });
            console.log("Found class starts from root.out:", this.classStartNodes);
            return;
        }
        
        // 3. Check nodes object for root entry
        if (nodes.root && nodes.root.out) {
            nodes.root.out.forEach((nodeId, idx) => {
                this.classStartNodes[idx] = String(nodeId);
            });
            console.log("Found class starts from nodes.root");
            return;
        }
        
        // 4. Check nodes for class start indicators
        Object.keys(nodes).forEach(nodeId => {
            const node = nodes[nodeId];
            if (!node || typeof node !== 'object') return;
            
            // Check for explicit class start flag
            if (node.isClassStart || node.classStartIndex !== undefined) {
                const idx = node.classStartIndex !== undefined ? node.classStartIndex : Object.keys(this.classStartNodes).length;
                this.classStartNodes[idx] = String(nodeId);
                return;
            }
            
            // Check name for class names
            const className = node.name?.toLowerCase();
            const classMap = {
                'warrior': 0, 'marauder': 1, 'ranger': 2, 'mercenary': 3,
                'sorceress': 4, 'witch': 5, 'monk': 6
            };
            if (classMap[className] !== undefined) {
                this.classStartNodes[classMap[className]] = String(nodeId);
            }
        });
        
        // 5. If still no starts found, use nodes with high connectivity
        if (Object.keys(this.classStartNodes).length === 0) {
            console.log("No class starts found, using fallback - searching for highly connected nodes");
            
            // Find nodes with many connections as potential class starts
            const nodeConnections = {};
            Object.keys(nodes).forEach(nodeId => {
                const node = nodes[nodeId];
                if (node && node.connections) {
                    nodeConnections[nodeId] = node.connections.length;
                }
            });
            
            // Get top connected nodes
            const sorted = Object.entries(nodeConnections)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 7);
            
            sorted.forEach((entry, idx) => {
                this.classStartNodes[idx] = entry[0];
            });
        }
        
        console.log("Found class starts:", this.classStartNodes);
    },
    
    /**
     * Parse nodes from the actual format
     */
    parseNodes: function(nodes) {
        let keystoneCount = 0;
        let notableCount = 0;
        let smallCount = 0;
        let travelCount = 0;
        
        Object.keys(nodes).forEach(nodeId => {
            // Skip non-object entries
            const rawNode = nodes[nodeId];
            if (!rawNode || typeof rawNode !== 'object') {
                return;
            }
            
            // Get basic info
            const name = rawNode.name || rawNode.dn || `Node ${nodeId}`;
            const stats = rawNode.stats || rawNode.sd || [];
            const icon = rawNode.icon || '';
            
            // Determine type from icon path or name patterns
            let type = 'small';
            
            // Check for keystone
            if (rawNode.isKeystone || /keystone/i.test(icon) || /keystone/i.test(name)) {
                type = 'keystone';
            }
            // Check for notable - larger icon, or specific icon patterns
            else if (rawNode.isNotable || /notable/i.test(icon) || 
                     /Notable|Mastery|Large/i.test(icon) ||
                     this.isLikelyNotable(rawNode, stats)) {
                type = 'notable';
            }
            
            // Calculate scores
            const scores = this.calculateScores(stats, rawNode);
            
            // Extract tags
            const tags = this.extractTags(stats, icon, rawNode);
            
            // Get connections (handling the {id, orbit} format)
            const connectionIds = this.extractConnectionIds(rawNode.connections);
            
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
                group: rawNode.group,
                orbit: rawNode.orbit,
                orbitIndex: rawNode.orbitIndex,
                skill: rawNode.skill,
                // Track if this is a "valuable" node or just travel
                isTravel: stats.length === 0 && !rawNode.isAttribute
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
            } else if (stats.length > 0 || rawNode.isAttribute) {
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
        
        // Handle array of {id, orbit} objects
        if (Array.isArray(connections)) {
            return connections.map(c => {
                if (typeof c === 'object' && c.id !== undefined) {
                    return String(c.id);
                } else if (typeof c === 'number' || typeof c === 'string') {
                    return String(c);
                }
                return null;
            }).filter(id => id !== null);
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
        
        // First pass: collect all connections
        Object.keys(nodes).forEach(nodeId => {
            const rawNode = nodes[nodeId];
            if (!rawNode || typeof rawNode !== 'object') return;
            
            const connectionIds = this.extractConnectionIds(rawNode.connections);
            
            if (!this.connections[nodeId]) {
                this.connections[nodeId] = [];
            }
            
            connectionIds.forEach(targetId => {
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
        
        // Second pass: make bidirectional
        const nodeIds = Object.keys(this.connections);
        nodeIds.forEach(nodeId => {
            const neighbors = [...this.connections[nodeId]];
            neighbors.forEach(targetId => {
                if (!this.connections[targetId]) {
                    this.connections[targetId] = [];
                }
                if (!this.connections[targetId].includes(nodeId)) {
                    this.connections[targetId].push(nodeId);
                }
            });
        });
        
        // Create stub nodes for missing node IDs (needed for pathfinding)
        missingNodes.forEach(nodeId => {
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
        
        // Also ensure all class start nodes exist
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
                // Make sure it's in connections too
                if (!this.connections[nodeId]) {
                    this.connections[nodeId] = [];
                }
            }
        });
        
        console.log(`Built ${connectionCount} connections across ${Object.keys(this.connections).length} nodes`);
        console.log(`Created ${missingNodes.size} stub nodes for pathfinding`);
        
        // Log a sample connection
        const sampleNodeId = Object.keys(this.connections)[0];
        if (sampleNodeId) {
            console.log(`Sample: Node ${sampleNodeId} connects to:`, this.connections[sampleNodeId]);
        }
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
