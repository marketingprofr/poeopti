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
     * Get class for ascendancy - with flexible mapping
     */
    getClassForAscendancy: function(ascendancy) {
        const asc = ascendancy?.toLowerCase();
        
        // Standard POE2 mapping
        const standardMap = {
            'titan': 'warrior', 'warbringer': 'warrior',
            'bloodmage': 'witch', 'infernalist': 'witch',
            'deadeye': 'ranger', 'pathfinder': 'ranger',
            'witchhunter': 'mercenary', 'gemlinglegionnaire': 'mercenary',
            'chronomancer': 'sorceress', 'stormweaver': 'sorceress',
            'acolyte': 'witch', 'invoker': 'monk',
            'chayuladisciple': 'monk', 'invokermonk': 'monk'
        };
        
        let className = standardMap[asc];
        
        // If we have the class in our loaded data, use it
        if (className && this.classStartNodes[className]) {
            return className;
        }
        
        // Fallback mappings - some tree.json files use different names
        // Map POE2 classes to POE1-style names if needed
        const fallbackMap = {
            'warrior': 'marauder',  // Warrior might be called Marauder in some trees
            'sorceress': 'witch',   // Sorceress might map to Witch area
            'mercenary': 'ranger',  // Mercenary might be near Ranger
            'monk': 'witch'         // Monk might be near Witch
        };
        
        if (className && fallbackMap[className] && this.classStartNodes[fallbackMap[className]]) {
            console.log(`Mapping ${className} -> ${fallbackMap[className]} (fallback)`);
            return fallbackMap[className];
        }
        
        // Direct ascendancy to available class mapping
        const directMap = {
            'titan': 'marauder', 'warbringer': 'marauder',
            'bloodmage': 'witch', 'infernalist': 'witch',
            'deadeye': 'ranger', 'pathfinder': 'ranger',
            'witchhunter': 'ranger', 'gemlinglegionnaire': 'ranger',
            'chronomancer': 'witch', 'stormweaver': 'witch',
            'acolyte': 'witch', 'invoker': 'witch',
            'chayuladisciple': 'witch', 'invokermonk': 'witch'
        };
        
        if (directMap[asc] && this.classStartNodes[directMap[asc]]) {
            console.log(`Using direct fallback: ${asc} -> ${directMap[asc]}`);
            return directMap[asc];
        }
        
        // Last resort: return first available class
        const available = Object.keys(this.classStartNodes);
        if (available.length > 0) {
            console.log(`No mapping found for ${ascendancy}, using first available: ${available[0]}`);
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
        
        // Debug: what's in data.classes?
        if (data.classes) {
            console.log("data.classes exists, type:", typeof data.classes, "isArray:", Array.isArray(data.classes));
            console.log("data.classes length:", data.classes.length);
            data.classes.forEach((cls, idx) => {
                console.log(`Class[${idx}]:`, JSON.stringify(cls).substring(0, 200));
            });
        } else {
            console.log("data.classes does NOT exist");
        }
        
        // Debug: what's in data.root?
        if (data.root) {
            console.log("data.root exists:", JSON.stringify(data.root).substring(0, 300));
        }
        
        // Debug: check nodes.root
        if (nodes.root) {
            console.log("nodes.root exists:", JSON.stringify(nodes.root).substring(0, 300));
        }
        
        // 1. Check for classes array
        if (data.classes && Array.isArray(data.classes)) {
            data.classes.forEach((cls, idx) => {
                // Try multiple possible property names for start node
                const startNode = cls.startNode || cls.start_node || cls.startNodeId;
                const className = (cls.name || cls.className || cls.class_name || '').toLowerCase();
                
                console.log(`Parsing class[${idx}]: name="${className}", startNode=${startNode}`);
                
                if (startNode && className) {
                    this.classStartNodes[className] = String(startNode);
                } else if (startNode) {
                    // No name, use index-based fallback
                    const classNames = ['warrior', 'marauder', 'ranger', 'mercenary', 'sorceress', 'witch', 'monk'];
                    if (classNames[idx]) {
                        this.classStartNodes[classNames[idx]] = String(startNode);
                        console.log(`Using index-based name: ${classNames[idx]}`);
                    }
                }
            });
            
            if (Object.keys(this.classStartNodes).length > 0) {
                console.log("Found class starts from classes array:", this.classStartNodes);
                return;
            }
        }
        
        // 2. Check for root.out combined with classes for names
        if (data.root && data.root.out && Array.isArray(data.root.out)) {
            console.log("Trying root.out approach, length:", data.root.out.length);
            
            const classNames = ['warrior', 'marauder', 'ranger', 'mercenary', 'sorceress', 'witch', 'monk'];
            
            data.root.out.forEach((nodeId, idx) => {
                let className = null;
                
                // Try to get name from classes array
                if (data.classes && data.classes[idx]) {
                    className = (data.classes[idx].name || data.classes[idx].className || '').toLowerCase();
                }
                
                // Fallback to index-based name
                if (!className && classNames[idx]) {
                    className = classNames[idx];
                }
                
                if (className) {
                    this.classStartNodes[className] = String(nodeId);
                    console.log(`root.out[${idx}] = ${nodeId} -> ${className}`);
                }
            });
            
            if (Object.keys(this.classStartNodes).length > 0) {
                console.log("Found class starts from root.out:", this.classStartNodes);
                return;
            }
        }
        
        // 3. Check nodes for root entry
        if (nodes.root && nodes.root.out) {
            console.log("Trying nodes.root.out approach");
            const classNames = ['warrior', 'marauder', 'ranger', 'mercenary', 'sorceress', 'witch', 'monk'];
            
            nodes.root.out.forEach((nodeId, idx) => {
                if (classNames[idx]) {
                    this.classStartNodes[classNames[idx]] = String(nodeId);
                }
            });
            
            if (Object.keys(this.classStartNodes).length > 0) {
                console.log("Found class starts from nodes.root:", this.classStartNodes);
                return;
            }
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
        
        // Get all class start node IDs to potentially filter cross-class connections
        const classStartSet = new Set(Object.values(this.classStartNodes));
        
        // First pass: collect all connections
        Object.keys(nodes).forEach(nodeId => {
            // SKIP the root node - it connects all class starts together
            if (nodeId === 'root') return;
            
            const rawNode = nodes[nodeId];
            if (!rawNode || typeof rawNode !== 'object') return;
            
            const connectionIds = this.extractConnectionIds(rawNode.connections);
            
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
        
        // Second pass: make bidirectional
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
                }
            });
        });
        
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
        
        console.log(`Built ${connectionCount} connections across ${Object.keys(this.connections).length} nodes`);
        console.log(`Created ${missingNodes.size} stub nodes for pathfinding`);
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
