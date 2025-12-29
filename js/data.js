/**
 * POE2 Passive Tree Data Module - FIXED VERSION
 * 
 * Key fixes:
 * 1. Stores ALL nodes for complete connection graph
 * 2. Properly finds class start nodes from tree.json
 * 3. Separates "valuable" nodes from "travel" nodes
 */

const POE2Data = {
    version: "0.3",
    isLoaded: false,
    
    // All nodes (for pathfinding)
    allNodes: {},
    
    // Categorized nodes (for optimization scoring)
    keystones: {},
    notables: {},
    smallNodes: {},
    travelNodes: {}, // Nodes with no stats - just for pathing
    
    // Connection graph
    connections: {},
    
    // Class starting node IDs (from root.out in tree.json)
    classStartNodes: {},
    
    // Groups for positioning
    groups: {},
    
    /**
     * Clear all loaded data
     */
    clear: function() {
        this.allNodes = {};
        this.keystones = {};
        this.notables = {};
        this.smallNodes = {};
        this.travelNodes = {};
        this.connections = {};
        this.classStartNodes = {};
        this.groups = {};
        this.isLoaded = false;
    },
    
    /**
     * Get all valuable nodes (excluding travel nodes)
     */
    getValuableNodes: function() {
        return { ...this.keystones, ...this.notables, ...this.smallNodes };
    },
    
    /**
     * Get keystones list for dropdown
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
     * Get starting node for a class
     */
    getClassStartNode: function(className) {
        // Map class names to their start node
        const classMap = {
            'warrior': 0,
            'marauder': 1, 
            'ranger': 2,
            'mercenary': 3,
            'sorceress': 4,
            'witch': 5,
            'monk': 6
        };
        
        const classIndex = classMap[className?.toLowerCase()];
        if (classIndex !== undefined && this.classStartNodes[classIndex]) {
            return this.classStartNodes[classIndex];
        }
        
        // Fallback: return first start node we have
        const startNodes = Object.values(this.classStartNodes);
        return startNodes.length > 0 ? startNodes[0] : null;
    },
    
    /**
     * Get class name for an ascendancy
     */
    getClassForAscendancy: function(ascendancy) {
        const ascendancyMap = {
            'titan': 'warrior',
            'warbringer': 'warrior',
            'bloodmage': 'marauder',
            'infernalist': 'marauder',
            'deadeye': 'ranger',
            'pathfinder': 'ranger',
            'witchhunter': 'mercenary',
            'gemlinglegionnaire': 'mercenary',
            'chronomancer': 'sorceress',
            'stormweaver': 'sorceress',
            'acolyte': 'witch',
            'invoker': 'witch',
            'chayuladisciple': 'monk',
            'invokermonk': 'monk'
        };
        
        return ascendancyMap[ascendancy?.toLowerCase()] || null;
    },
    
    /**
     * Load tree data from JSON (POB format)
     */
    loadFromJSON: function(jsonData) {
        try {
            console.log("=== Loading tree data ===");
            this.clear();
            
            // Store version
            if (jsonData.tree) {
                this.version = jsonData.tree;
                console.log("Tree version:", this.version);
            }
            
            // Store groups for positioning
            if (jsonData.groups) {
                this.groups = jsonData.groups;
                console.log("Groups loaded:", Object.keys(this.groups).length);
            }
            
            // Check for nodes
            if (!jsonData.nodes) {
                console.error("ERROR: No 'nodes' property in JSON!");
                console.log("Available keys:", Object.keys(jsonData));
                return false;
            }
            
            console.log("Total raw nodes:", Object.keys(jsonData.nodes).length);
            
            // Find class start nodes from root
            if (jsonData.nodes.root) {
                const rootOut = jsonData.nodes.root.out || [];
                console.log("Root.out nodes:", rootOut);
                rootOut.forEach((nodeId, index) => {
                    this.classStartNodes[index] = String(nodeId);
                });
                console.log("Class start nodes mapped:", this.classStartNodes);
            } else {
                console.warn("WARNING: No root node found in tree.json");
                // Try to find class starts another way - look for spc property
                Object.keys(jsonData.nodes).forEach(nodeId => {
                    const node = jsonData.nodes[nodeId];
                    if (node.spc && node.spc.length > 0) {
                        node.spc.forEach(classIndex => {
                            this.classStartNodes[classIndex] = String(nodeId);
                        });
                    }
                });
                console.log("Found class starts via spc:", this.classStartNodes);
            }
            
            // Parse ALL nodes
            console.log("Parsing nodes...");
            this.parseAllNodes(jsonData.nodes);
            
            // Build complete connection graph
            console.log("Building connection graph...");
            this.buildConnectionGraph(jsonData.nodes);
            
            this.isLoaded = true;
            
            console.log("=== Load complete ===");
            console.log(`Keystones: ${Object.keys(this.keystones).length}`);
            console.log(`Notables: ${Object.keys(this.notables).length}`);
            console.log(`Small nodes: ${Object.keys(this.smallNodes).length}`);
            console.log(`Travel nodes: ${Object.keys(this.travelNodes).length}`);
            console.log(`Total in allNodes: ${Object.keys(this.allNodes).length}`);
            console.log(`Total connections: ${Object.keys(this.connections).length}`);
            
            if (Object.keys(this.keystones).length === 0) {
                console.warn("WARNING: No keystones found! Checking node structure...");
                // Sample a few nodes to see their structure
                const sampleIds = Object.keys(jsonData.nodes).slice(0, 5);
                sampleIds.forEach(id => {
                    console.log(`Sample node ${id}:`, JSON.stringify(jsonData.nodes[id]).slice(0, 200));
                });
            }
            
            return true;
        } catch (e) {
            console.error("Failed to load tree data:", e);
            console.error("Stack:", e.stack);
            return false;
        }
    },
    
    /**
     * Parse all nodes from tree.json
     */
    parseAllNodes: function(nodes) {
        let parsed = 0;
        let skipped = { mastery: 0, jewel: 0, ascendancy: 0 };
        let types = { keystone: 0, notable: 0, small: 0, travel: 0 };
        
        Object.keys(nodes).forEach(nodeId => {
            if (nodeId === 'root') return; // Skip the special root node
            
            const rawNode = nodes[nodeId];
            
            // Skip if not an object
            if (typeof rawNode !== 'object' || rawNode === null) {
                return;
            }
            
            // Skip mastery nodes and jewel sockets
            if (rawNode.isMastery) {
                skipped.mastery++;
                return;
            }
            if (rawNode.isJewelSocket) {
                skipped.jewel++;
                return;
            }
            
            // Skip ascendancy nodes for now (they're separate)
            if (rawNode.ascendancyName) {
                skipped.ascendancy++;
                return;
            }
            
            // Determine node type - check multiple possible property names
            let type = 'small';
            if (rawNode.ks === true || rawNode.isKeystone === true) {
                type = 'keystone';
                types.keystone++;
            } else if (rawNode.not === true || rawNode.isNotable === true) {
                type = 'notable';
                types.notable++;
            }
            
            // Get stats - check multiple possible property names
            const stats = rawNode.sd || rawNode.stats || rawNode.reminderText || [];
            const name = rawNode.dn || rawNode.name || rawNode.displayName || `Node ${nodeId}`;
            
            // Calculate scores
            const scores = this.calculateNodeScores(stats, rawNode);
            
            // Extract tags
            const tags = this.extractTags(stats, rawNode);
            
            // Create node object
            const node = {
                id: String(nodeId),
                name: name,
                type: type,
                stats: Array.isArray(stats) ? stats : [],
                tags: tags,
                offense: scores.offense,
                defense: scores.defense,
                // Store connection info
                out: (rawNode.out || []).map(String),
                in: (rawNode.in || []).map(String),
                // Position info
                group: rawNode.g,
                // Attribute bonuses
                str: rawNode.sa || rawNode.strengthAdded || 0,
                dex: rawNode.da || rawNode.dexterityAdded || 0,
                int: rawNode.ia || rawNode.intelligenceAdded || 0
            };
            
            // Store in allNodes for pathfinding
            this.allNodes[nodeId] = node;
            parsed++;
            
            // Categorize based on type and stats
            if (type === 'keystone') {
                this.keystones[nodeId] = node;
            } else if (type === 'notable') {
                this.notables[nodeId] = node;
            } else if (stats.length > 0 || node.str > 0 || node.dex > 0 || node.int > 0) {
                this.smallNodes[nodeId] = node;
                types.small++;
            } else {
                // Travel node (no stats, just for pathing)
                this.travelNodes[nodeId] = node;
                types.travel++;
            }
        });
        
        console.log("Parse complete:");
        console.log("  Parsed:", parsed);
        console.log("  Skipped:", skipped);
        console.log("  Types:", types);
    },
    
    /**
     * Build complete connection graph from raw nodes
     */
    buildConnectionGraph: function(nodes) {
        // First pass: collect all connections from raw data
        Object.keys(nodes).forEach(nodeId => {
            if (nodeId === 'root') return;
            
            const rawNode = nodes[nodeId];
            const outConnections = (rawNode.out || []).map(String);
            const inConnections = (rawNode.in || []).map(String);
            
            // Store bidirectional connections
            this.connections[nodeId] = [...new Set([...outConnections, ...inConnections])];
        });
        
        // Second pass: ensure bidirectional consistency
        Object.keys(this.connections).forEach(nodeId => {
            this.connections[nodeId].forEach(neighborId => {
                if (!this.connections[neighborId]) {
                    this.connections[neighborId] = [];
                }
                if (!this.connections[neighborId].includes(nodeId)) {
                    this.connections[neighborId].push(nodeId);
                }
            });
        });
    },
    
    /**
     * Calculate offense/defense scores from stats
     */
    calculateNodeScores: function(stats, rawNode) {
        let offense = 0;
        let defense = 0;
        
        stats.forEach(stat => {
            const lower = stat.toLowerCase();
            const numMatch = stat.match(/(\d+(?:\.\d+)?)/);
            const value = numMatch ? parseFloat(numMatch[1]) : 10;
            const mult = value / 10;
            
            // Offense
            if (/damage/i.test(lower) && !/taken/i.test(lower)) offense += mult;
            if (/attack speed|cast speed/i.test(lower)) offense += mult * 1.5;
            if (/critical strike/i.test(lower)) offense += mult * 1.2;
            if (/penetrate/i.test(lower)) offense += mult * 1.5;
            if (/accuracy/i.test(lower)) offense += mult * 0.5;
            
            // Defense
            if (/maximum life/i.test(lower)) defense += mult * 1.5;
            if (/\+\d+.*life(?!.*regen)/i.test(lower)) defense += mult * 0.3;
            if (/armou?r/i.test(lower)) defense += mult * 0.8;
            if (/evasion/i.test(lower)) defense += mult * 0.8;
            if (/energy shield/i.test(lower)) defense += mult;
            if (/resistance/i.test(lower)) defense += mult * 0.8;
            if (/block/i.test(lower)) defense += mult * 1.2;
            if (/life regenerat/i.test(lower)) defense += mult * 0.6;
            if (/damage taken/i.test(lower) && /reduced|less/i.test(lower)) defense += mult * 1.5;
        });
        
        // Attribute bonuses
        if (rawNode) {
            const str = rawNode.sa || 0;
            const dex = rawNode.da || 0;
            const int = rawNode.ia || 0;
            offense += (str + dex + int) * 0.01;
            defense += str * 0.02;
        }
        
        return {
            offense: Math.round(offense * 10) / 10,
            defense: Math.round(defense * 10) / 10
        };
    },
    
    /**
     * Extract tags from stats
     */
    extractTags: function(stats, rawNode) {
        const tags = new Set();
        const text = stats.join(' ').toLowerCase();
        
        // Damage types
        if (/physical/i.test(text)) tags.add('physical');
        if (/fire/i.test(text)) tags.add('fire');
        if (/cold|freeze|chill/i.test(text)) tags.add('cold');
        if (/lightning|shock/i.test(text)) tags.add('lightning');
        if (/chaos|poison/i.test(text)) tags.add('chaos');
        if (/elemental/i.test(text)) tags.add('elemental');
        
        // Attack/spell
        if (/attack|melee attack|with attacks/i.test(text)) tags.add('attack');
        if (/spell|with spells|cast/i.test(text)) tags.add('spell');
        if (/melee/i.test(text)) tags.add('melee');
        
        // Weapons
        if (/\bbow\b/i.test(text)) tags.add('bow');
        if (/crossbow/i.test(text)) tags.add('crossbow');
        if (/projectile/i.test(text)) tags.add('projectile');
        if (/sword/i.test(text)) tags.add('sword');
        if (/axe/i.test(text)) tags.add('axe');
        if (/mace|sceptre/i.test(text)) tags.add('mace');
        if (/staff|staves/i.test(text)) tags.add('staff');
        if (/wand/i.test(text)) tags.add('wand');
        if (/claw/i.test(text)) tags.add('claw');
        if (/dagger/i.test(text)) tags.add('dagger');
        
        // Other
        if (/minion/i.test(text)) tags.add('minion');
        if (/totem/i.test(text)) tags.add('totem');
        if (/trap/i.test(text)) tags.add('trap');
        if (/critical/i.test(text)) tags.add('critical');
        if (/damage over time|burning|bleed|poison/i.test(text)) tags.add('dot');
        if (/area|radius/i.test(text)) tags.add('aoe');
        if (/life/i.test(text)) tags.add('life');
        if (/energy shield/i.test(text)) tags.add('energyshield');
        if (/armou?r/i.test(text)) tags.add('armour');
        if (/evasion/i.test(text)) tags.add('evasion');
        
        // Attribute tags
        if (rawNode) {
            if (rawNode.sa > 0) tags.add('strength');
            if (rawNode.da > 0) tags.add('dexterity');
            if (rawNode.ia > 0) tags.add('intelligence');
        }
        
        return Array.from(tags);
    },
    
    /**
     * Find shortest path between two nodes using BFS
     */
    findPath: function(startId, endId) {
        startId = String(startId);
        endId = String(endId);
        
        if (startId === endId) return [startId];
        if (!this.connections[startId]) return null;
        
        const visited = new Set();
        const queue = [[startId]];
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (visited.has(current)) continue;
            visited.add(current);
            
            const neighbors = this.connections[current] || [];
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
    },
    
    /**
     * Get neighbors of a node
     */
    getNeighbors: function(nodeId) {
        return this.connections[String(nodeId)] || [];
    }
};

console.log("POE2Data module loaded. Use loadFromJSON() to load tree.json data.");
