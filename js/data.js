/**
 * POE2 Passive Tree Data Module
 * 
 * This module handles loading and parsing tree data from POB tree.json
 * No sample/mock data - only real data from loaded files
 */

const POE2Data = {
    version: "0.3",
    isLoaded: false,
    
    // Character classes and their starting positions
    classes: {
        warrior: { id: 0, name: "Warrior", startNode: null, attribute: "str" },
        marauder: { id: 1, name: "Marauder", startNode: null, attribute: "str" },
        ranger: { id: 2, name: "Ranger", startNode: null, attribute: "dex" },
        mercenary: { id: 3, name: "Mercenary", startNode: null, attribute: "dex" },
        sorceress: { id: 4, name: "Sorceress", startNode: null, attribute: "int" },
        witch: { id: 5, name: "Witch", startNode: null, attribute: "int" },
        monk: { id: 6, name: "Monk", startNode: null, attribute: "dex_int" },
    },
    
    // Ascendancy mappings
    ascendancies: {
        // Warrior Ascendancies
        titan: { class: "warrior", name: "Titan" },
        warbringer: { class: "warrior", name: "Warbringer" },
        
        // Marauder Ascendancies
        bloodmage: { class: "marauder", name: "Blood Mage" },
        infernalist: { class: "marauder", name: "Infernalist" },
        
        // Ranger Ascendancies
        deadeye: { class: "ranger", name: "Deadeye" },
        pathfinder: { class: "ranger", name: "Pathfinder" },
        
        // Mercenary Ascendancies
        witchhunter: { class: "mercenary", name: "Witchhunter" },
        gemlinglegionnaire: { class: "mercenary", name: "Gemling Legionnaire" },
        
        // Sorceress Ascendancies
        chronomancer: { class: "sorceress", name: "Chronomancer" },
        stormweaver: { class: "sorceress", name: "Stormweaver" },
        
        // Witch Ascendancies
        acolyte: { class: "witch", name: "Acolyte of Chayula" },
        invoker: { class: "witch", name: "Invoker" },
        
        // Monk Ascendancies
        chayuladisciple: { class: "monk", name: "Disciple of Chayula" },
        invokermonk: { class: "monk", name: "Invoker of Storms" },
    },
    
    // Actual tree data - populated from loaded JSON
    keystones: {},
    notables: {},
    smallNodes: {},
    connections: {},
    groups: {},
    
    // Raw nodes for reference
    rawNodes: {},
    
    /**
     * Clear all loaded data
     */
    clear: function() {
        this.keystones = {};
        this.notables = {};
        this.smallNodes = {};
        this.connections = {};
        this.groups = {};
        this.rawNodes = {};
        this.isLoaded = false;
    },
    
    /**
     * Get all nodes
     */
    getAllNodes: function() {
        return { ...this.keystones, ...this.notables, ...this.smallNodes };
    },
    
    /**
     * Get keystones list for dropdown
     */
    getKeystonesList: function() {
        return Object.values(this.keystones).map(ks => ({
            id: ks.id,
            name: ks.name,
            stats: ks.stats,
            offense: ks.offense,
            defense: ks.defense
        }));
    },
    
    /**
     * Get class for ascendancy
     */
    getClassForAscendancy: function(ascendancy) {
        const asc = this.ascendancies[ascendancy];
        return asc ? this.classes[asc.class] : null;
    },
    
    /**
     * Load tree data from JSON (POB format)
     */
    loadFromJSON: function(jsonData) {
        try {
            console.log("Loading tree data...");
            
            // Clear existing data
            this.clear();
            
            // Store version if present
            if (jsonData.tree) {
                this.version = jsonData.tree;
            }
            
            // Parse groups for positioning first
            if (jsonData.groups) {
                this.groups = jsonData.groups;
            }
            
            // Parse nodes
            if (jsonData.nodes) {
                this.parseNodes(jsonData.nodes);
            }
            
            // Parse class start positions
            if (jsonData.classes) {
                this.parseClasses(jsonData.classes);
            }
            
            // Build connections graph
            this.buildConnectionGraph();
            
            this.isLoaded = true;
            
            console.log(`Loaded: ${Object.keys(this.keystones).length} keystones, ${Object.keys(this.notables).length} notables, ${Object.keys(this.smallNodes).length} small nodes`);
            
            return true;
        } catch (e) {
            console.error("Failed to load tree data:", e);
            return false;
        }
    },
    
    /**
     * Parse nodes from POB format
     */
    parseNodes: function(nodes) {
        Object.keys(nodes).forEach(nodeId => {
            const pobNode = nodes[nodeId];
            
            // Skip mastery nodes, jewel sockets, and root/class start nodes
            if (pobNode.isMastery || pobNode.isJewelSocket || pobNode.isAscendancyStart) {
                return;
            }
            
            // Skip proxy/hidden nodes
            if (pobNode.isProxy || pobNode.ascendancyName) {
                return;
            }
            
            // Determine node type based on POB flags
            let type = "small";
            if (pobNode.ks === true || pobNode.isKeystone === true) {
                type = "keystone";
            } else if (pobNode.not === true || pobNode.isNotable === true) {
                type = "notable";
            }
            
            // Get node name - POB uses 'dn' for display name
            const name = pobNode.dn || pobNode.name || `Node ${nodeId}`;
            
            // Parse stats/descriptions - POB uses 'sd' array
            const stats = pobNode.sd || pobNode.stats || [];
            
            // Skip nodes without meaningful stats (pure travel nodes)
            // But keep attribute nodes (they have sa, da, ia values)
            const hasAttributes = (pobNode.sa > 0 || pobNode.da > 0 || pobNode.ia > 0);
            if (stats.length === 0 && !hasAttributes && type === "small") {
                return;
            }
            
            // Calculate offense/defense scores based on stats
            const scores = this.calculateNodeScores(stats, pobNode);
            
            // Extract tags from stats
            const tags = this.extractTagsFromStats(stats);
            
            // Add attribute tags
            if (pobNode.sa > 0) tags.push('strength');
            if (pobNode.da > 0) tags.push('dexterity');
            if (pobNode.ia > 0) tags.push('intelligence');
            
            // Get position
            let position = { x: 0, y: 0 };
            if (pobNode.g !== undefined && this.groups[pobNode.g]) {
                const group = this.groups[pobNode.g];
                position = { x: group.x || 0, y: group.y || 0 };
            }
            
            const node = {
                id: String(nodeId),
                name: name,
                type: type,
                stats: stats,
                tags: tags,
                offense: scores.offense,
                defense: scores.defense,
                position: position,
                // Store attribute bonuses
                str: pobNode.sa || 0,
                dex: pobNode.da || 0,
                int: pobNode.ia || 0,
                // Store connections
                out: (pobNode.out || []).map(String),
                in: (pobNode.in || []).map(String)
            };
            
            // Store raw node for reference
            this.rawNodes[nodeId] = pobNode;
            
            // Store in appropriate collection
            if (type === 'keystone') {
                this.keystones[nodeId] = node;
            } else if (type === 'notable') {
                this.notables[nodeId] = node;
            } else {
                this.smallNodes[nodeId] = node;
            }
        });
    },
    
    /**
     * Calculate offense/defense scores from stats
     */
    calculateNodeScores: function(stats, pobNode) {
        let offense = 0;
        let defense = 0;
        
        stats.forEach(stat => {
            const lowerStat = stat.toLowerCase();
            
            // Parse numeric values from stat strings
            const numMatch = stat.match(/(\d+(?:\.\d+)?)/);
            const value = numMatch ? parseFloat(numMatch[1]) : 10;
            const multiplier = value / 10;
            
            // Offense patterns
            if (/damage/i.test(lowerStat) && !/taken/i.test(lowerStat)) {
                offense += multiplier;
            }
            if (/attack speed|cast speed/i.test(lowerStat)) {
                offense += multiplier * 1.5;
            }
            if (/critical strike/i.test(lowerStat)) {
                offense += multiplier * 1.2;
            }
            if (/penetrate/i.test(lowerStat)) {
                offense += multiplier * 1.5;
            }
            if (/accuracy/i.test(lowerStat)) {
                offense += multiplier * 0.5;
            }
            if (/minion.*damage|damage.*minion/i.test(lowerStat)) {
                offense += multiplier;
            }
            
            // Defense patterns
            if (/maximum life/i.test(lowerStat)) {
                defense += multiplier * 1.5;
            }
            if (/\+\d+.*life(?!.*regen)/i.test(lowerStat)) {
                defense += multiplier * 0.3;
            }
            if (/armour|armor/i.test(lowerStat)) {
                defense += multiplier * 0.8;
            }
            if (/evasion/i.test(lowerStat)) {
                defense += multiplier * 0.8;
            }
            if (/energy shield/i.test(lowerStat)) {
                defense += multiplier;
            }
            if (/resistance/i.test(lowerStat)) {
                defense += multiplier * 0.8;
            }
            if (/block/i.test(lowerStat)) {
                defense += multiplier * 1.2;
            }
            if (/dodge/i.test(lowerStat)) {
                defense += multiplier * 1.2;
            }
            if (/life regenerat/i.test(lowerStat)) {
                defense += multiplier * 0.6;
            }
            if (/damage taken/i.test(lowerStat) && /reduced|less/i.test(lowerStat)) {
                defense += multiplier * 1.5;
            }
            if (/leech/i.test(lowerStat)) {
                defense += multiplier * 0.5;
            }
            if (/cannot be stunned|stun immune/i.test(lowerStat)) {
                defense += 2;
            }
            if (/fortify/i.test(lowerStat)) {
                defense += multiplier * 0.8;
            }
        });
        
        // Attribute bonuses
        if (pobNode) {
            const str = pobNode.sa || 0;
            const dex = pobNode.da || 0;
            const int = pobNode.ia || 0;
            
            // Small attribute bonuses
            offense += (str + dex + int) * 0.01;
            defense += str * 0.02; // Strength gives life
        }
        
        return {
            offense: Math.round(offense * 10) / 10,
            defense: Math.round(defense * 10) / 10
        };
    },
    
    /**
     * Extract tags from stats
     */
    extractTagsFromStats: function(stats) {
        const tags = new Set();
        const statText = stats.join(' ').toLowerCase();
        
        const tagKeywords = {
            'physical': ['physical'],
            'fire': ['fire'],
            'cold': ['cold', 'freeze', 'chill'],
            'lightning': ['lightning', 'shock'],
            'chaos': ['chaos', 'poison'],
            'elemental': ['elemental'],
            'attack': ['attack', 'with attacks', 'melee attack'],
            'spell': ['spell', 'with spells', 'cast'],
            'melee': ['melee'],
            'bow': ['bow', 'with bows'],
            'crossbow': ['crossbow'],
            'projectile': ['projectile'],
            'minion': ['minion', 'zombie', 'skeleton', 'spectre'],
            'critical': ['critical'],
            'dot': ['damage over time'],
            'bleed': ['bleed', 'bleeding'],
            'poison': ['poison'],
            'ignite': ['ignite', 'burning damage'],
            'life': ['life'],
            'mana': ['mana'],
            'energyshield': ['energy shield'],
            'armour': ['armour', 'armor'],
            'evasion': ['evasion'],
            'resistance': ['resistance'],
            'block': ['block'],
            'dodge': ['dodge'],
            'aoe': ['area of effect', 'area damage', 'radius'],
            'duration': ['duration'],
            'totem': ['totem'],
            'trap': ['trap'],
            'mine': ['mine'],
            'warcry': ['warcry'],
            'slam': ['slam'],
            'strike': ['strike'],
            'staff': ['staff', 'staves'],
            'wand': ['wand'],
            'sword': ['sword'],
            'axe': ['axe'],
            'mace': ['mace', 'sceptre'],
            'claw': ['claw'],
            'dagger': ['dagger'],
            'shield': ['shield', 'while holding a shield'],
            'dualwield': ['dual wield', 'while dual wielding'],
            'twohanded': ['two handed', 'two-handed'],
        };
        
        Object.keys(tagKeywords).forEach(tag => {
            if (tagKeywords[tag].some(keyword => statText.includes(keyword))) {
                tags.add(tag);
            }
        });
        
        return Array.from(tags);
    },
    
    /**
     * Parse class starting positions
     */
    parseClasses: function(classData) {
        if (Array.isArray(classData)) {
            classData.forEach((cls) => {
                const className = cls.name?.toLowerCase();
                if (className && this.classes[className]) {
                    this.classes[className].startNode = cls.startNode;
                }
            });
        }
    },
    
    /**
     * Build connection graph from node data
     */
    buildConnectionGraph: function() {
        const allNodes = this.getAllNodes();
        
        Object.keys(allNodes).forEach(nodeId => {
            const node = allNodes[nodeId];
            // Combine 'out' and 'in' connections (bidirectional)
            const connections = new Set([...(node.out || []), ...(node.in || [])]);
            this.connections[nodeId] = Array.from(connections);
        });
    },
    
    /**
     * Find path between two nodes using BFS
     */
    findPath: function(startId, endId) {
        if (startId === endId) return [startId];
        
        const visited = new Set();
        const queue = [[startId]];
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (current === endId) {
                return path;
            }
            
            if (visited.has(current)) continue;
            visited.add(current);
            
            const neighbors = this.connections[current] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push([...path, neighbor]);
                }
            }
        }
        
        return null;
    },
    
    /**
     * Get nodes connected to the allocated tree
     */
    getConnectedNodes: function(allocatedIds) {
        const connected = new Set();
        const allocatedSet = new Set(allocatedIds);
        
        allocatedIds.forEach(nodeId => {
            const neighbors = this.connections[nodeId] || [];
            neighbors.forEach(neighbor => {
                if (!allocatedSet.has(neighbor)) {
                    connected.add(neighbor);
                }
            });
        });
        
        return Array.from(connected);
    }
};

// Log ready status
console.log("POE2Data module loaded. Load tree.json to begin.");
