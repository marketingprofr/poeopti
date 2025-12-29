/**
 * POE2 Passive Tree Data Module
 * 
 * This module contains the tree data structure and sample nodes.
 * The structure is designed to be compatible with POB tree.json format.
 * 
 * To load real data:
 * 1. Export tree.json from POB POE2
 * 2. Use the loadTreeData() function or import via UI
 */

const POE2Data = {
    version: "0.3", // POE2 Early Access version
    isLoaded: false,
    
    // Character classes and their starting positions
    classes: {
        warrior: { id: 0, name: "Warrior", startNode: "warrior_start", attribute: "str" },
        marauder: { id: 1, name: "Marauder", startNode: "marauder_start", attribute: "str" },
        ranger: { id: 2, name: "Ranger", startNode: "ranger_start", attribute: "dex" },
        mercenary: { id: 3, name: "Mercenary", startNode: "mercenary_start", attribute: "dex" },
        sorceress: { id: 4, name: "Sorceress", startNode: "sorceress_start", attribute: "int" },
        witch: { id: 5, name: "Witch", startNode: "witch_start", attribute: "int" },
        monk: { id: 6, name: "Monk", startNode: "monk_start", attribute: "dex_int" },
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
    
    // Keystones - powerful nodes with significant trade-offs
    keystones: {
        // Offense Keystones
        ironwill: {
            id: "ks_ironwill",
            name: "Iron Will",
            type: "keystone",
            stats: ["Strength provides bonus to Spell Damage instead of Melee Physical Damage"],
            tags: ["spell", "strength"],
            offense: 10,
            defense: 0,
            position: { x: 0, y: -200 }
        },
        ancestralvision: {
            id: "ks_ancestralvision",
            name: "Ancestral Vision",
            type: "keystone",
            stats: ["+50% Critical Strike Multiplier", "Cannot deal Non-Critical Strikes"],
            tags: ["critical"],
            offense: 15,
            defense: -5,
            position: { x: 100, y: -150 }
        },
        perfectagony: {
            id: "ks_perfectagony",
            name: "Perfect Agony",
            type: "keystone",
            stats: ["Modifiers to Critical Strike Multiplier apply to Damage over Time Multiplier at 50% value", "30% less Damage with Hits"],
            tags: ["critical", "dot", "poison", "bleed"],
            offense: 12,
            defense: 0,
            position: { x: -100, y: -150 }
        },
        bloodmagic: {
            id: "ks_bloodmagic",
            name: "Blood Magic",
            type: "keystone",
            stats: ["Removes all Mana", "Spend Life instead of Mana for Skills"],
            tags: ["life"],
            offense: 5,
            defense: -8,
            position: { x: 200, y: 0 }
        },
        elementalequilibrium: {
            id: "ks_elementalequilibrium",
            name: "Elemental Equilibrium",
            type: "keystone",
            stats: ["Enemies you hit with Elemental Damage temporarily become resistant to that Element but vulnerable to other Elements"],
            tags: ["fire", "cold", "lightning", "elemental"],
            offense: 12,
            defense: 0,
            position: { x: -200, y: 0 }
        },
        avatarfire: {
            id: "ks_avatarfire",
            name: "Avatar of Fire",
            type: "keystone",
            stats: ["50% of Physical, Cold and Lightning Damage Converted to Fire Damage", "Deal no Non-Fire Damage"],
            tags: ["fire", "conversion"],
            offense: 10,
            defense: 0,
            position: { x: 150, y: 150 }
        },
        crimsonblast: {
            id: "ks_crimsonblast",
            name: "Crimson Dance",
            type: "keystone",
            stats: ["You can inflict Bleeding on an Enemy up to 8 times", "Your Bleeding does not deal extra Damage while Enemy is moving", "50% less Damage with Bleeding"],
            tags: ["bleed", "attack", "physical"],
            offense: 14,
            defense: 0,
            position: { x: -150, y: 150 }
        },
        
        // Defense Keystones
        ghostreaver: {
            id: "ks_ghostreaver",
            name: "Ghost Reaver",
            type: "keystone",
            stats: ["Leech Energy Shield instead of Life", "50% less Energy Shield Recharge Rate"],
            tags: ["energyshield", "leech"],
            offense: 0,
            defense: 12,
            position: { x: 0, y: 200 }
        },
        painattunement: {
            id: "ks_painattunement",
            name: "Pain Attunement",
            type: "keystone",
            stats: ["30% more Spell Damage when on Low Life"],
            tags: ["spell", "lowlife"],
            offense: 10,
            defense: -3,
            position: { x: 50, y: 200 }
        },
        acrobatics: {
            id: "ks_acrobatics",
            name: "Acrobatics",
            type: "keystone",
            stats: ["+30% chance to Dodge Attack Hits", "50% less Armour", "30% less Energy Shield"],
            tags: ["dodge", "evasion"],
            offense: 0,
            defense: 10,
            position: { x: -150, y: -200 }
        },
        ironreflexes: {
            id: "ks_ironreflexes",
            name: "Iron Reflexes",
            type: "keystone",
            stats: ["Converts all Evasion Rating to Armour"],
            tags: ["armour", "evasion"],
            offense: 0,
            defense: 12,
            position: { x: 150, y: -200 }
        },
        unwavering: {
            id: "ks_unwavering",
            name: "Unwavering Stance",
            type: "keystone",
            stats: ["Cannot Evade enemy Attacks", "Cannot be Stunned"],
            tags: ["stun"],
            offense: 2,
            defense: 8,
            position: { x: 200, y: -100 }
        },
        mindbodyspirit: {
            id: "ks_mindbodyspirit",
            name: "Mind Over Matter",
            type: "keystone",
            stats: ["40% of Damage is taken from Mana before Life"],
            tags: ["mana", "life"],
            offense: 0,
            defense: 15,
            position: { x: -200, y: -100 }
        },
        zealotsoath: {
            id: "ks_zealotsoath",
            name: "Zealot's Oath",
            type: "keystone",
            stats: ["Life Regeneration is applied to Energy Shield instead"],
            tags: ["energyshield", "regeneration"],
            offense: 0,
            defense: 10,
            position: { x: 0, y: -250 }
        },
        
        // Hybrid Keystones
        necromancy: {
            id: "ks_necromancy",
            name: "Necromantic Aegis",
            type: "keystone",
            stats: ["All bonuses from your Shield apply to your Minions instead of you"],
            tags: ["minion", "shield"],
            offense: 8,
            defense: -5,
            position: { x: -100, y: 200 }
        },
        eldritch: {
            id: "ks_eldritch",
            name: "Eldritch Battery",
            type: "keystone",
            stats: ["Spend Energy Shield before Mana for Skill Costs", "Energy Shield protects Mana instead of Life"],
            tags: ["energyshield", "mana"],
            offense: 6,
            defense: 4,
            position: { x: 100, y: 200 }
        }
    },
    
    // Notable nodes - medium power nodes
    notables: {},
    
    // Small nodes
    smallNodes: {},
    
    // Graph connections
    connections: {},
    
    // Initialize sample data
    init: function() {
        this.generateSampleNotables();
        this.generateSampleSmallNodes();
        this.generateConnections();
        this.isLoaded = true;
    },
    
    generateSampleNotables: function() {
        // Physical Attack notables
        const physicalNotables = [
            { id: "n_heavyhits", name: "Heavy Hits", stats: ["+25% Physical Damage", "+10% Attack Speed"], tags: ["physical", "attack"], offense: 6, defense: 0 },
            { id: "n_brutality", name: "Brutal Blade", stats: ["+30% Physical Damage with Swords", "+15% Critical Strike Chance"], tags: ["physical", "attack", "sword", "critical"], offense: 7, defense: 0 },
            { id: "n_macemastery", name: "Mace Mastery", stats: ["+40% Physical Damage with Maces", "+20% Stun Duration"], tags: ["physical", "attack", "mace", "stun"], offense: 6, defense: 1 },
            { id: "n_axemastery", name: "Axe Mastery", stats: ["+35% Physical Damage with Axes", "+10% Bleed Chance"], tags: ["physical", "attack", "axe", "bleed"], offense: 7, defense: 0 },
            { id: "n_slampower", name: "Slam Power", stats: ["+40% Slam Damage", "+15% Area of Effect"], tags: ["physical", "attack", "slam", "aoe"], offense: 8, defense: 0 },
            { id: "n_strikepower", name: "Precise Strikes", stats: ["+25% Strike Damage", "+20% Accuracy Rating"], tags: ["physical", "attack", "strike"], offense: 5, defense: 0 },
        ];
        
        // Elemental notables
        const elementalNotables = [
            { id: "n_firepower", name: "Burning Intensity", stats: ["+30% Fire Damage", "+15% Ignite Duration"], tags: ["fire", "elemental"], offense: 6, defense: 0 },
            { id: "n_freezing", name: "Deep Freeze", stats: ["+30% Cold Damage", "+10% Freeze Chance"], tags: ["cold", "elemental"], offense: 5, defense: 2 },
            { id: "n_shocking", name: "Conductivity", stats: ["+30% Lightning Damage", "+10% Shock Effect"], tags: ["lightning", "elemental"], offense: 6, defense: 0 },
            { id: "n_elemental", name: "Elemental Mastery", stats: ["+20% Elemental Damage", "+5% to all Elemental Resistances"], tags: ["fire", "cold", "lightning", "elemental"], offense: 5, defense: 3 },
            { id: "n_spelldmg", name: "Arcane Power", stats: ["+25% Spell Damage", "+10% Cast Speed"], tags: ["spell"], offense: 6, defense: 0 },
            { id: "n_spellcrit", name: "Spell Precision", stats: ["+40% Critical Strike Chance for Spells", "+20% Spell Critical Strike Multiplier"], tags: ["spell", "critical"], offense: 8, defense: 0 },
        ];
        
        // Ranged notables
        const rangedNotables = [
            { id: "n_bowmastery", name: "Bow Mastery", stats: ["+30% Damage with Bows", "+10% Attack Speed with Bows"], tags: ["bow", "attack", "projectile"], offense: 6, defense: 0 },
            { id: "n_projectile", name: "Projectile Mastery", stats: ["+25% Projectile Damage", "+1 Pierce"], tags: ["projectile"], offense: 5, defense: 0 },
            { id: "n_crossbow", name: "Crossbow Expertise", stats: ["+35% Damage with Crossbows", "+15% Reload Speed"], tags: ["crossbow", "attack", "projectile"], offense: 7, defense: 0 },
        ];
        
        // Defense notables
        const defenseNotables = [
            { id: "n_lifepool", name: "Constitution", stats: ["+8% maximum Life", "+20 to maximum Life"], tags: ["life"], offense: 0, defense: 6 },
            { id: "n_armorup", name: "Armoured Shell", stats: ["+30% Armour", "+5% Physical Damage Reduction"], tags: ["armour"], offense: 0, defense: 7 },
            { id: "n_evasion", name: "Nimble Feet", stats: ["+30% Evasion Rating", "+10% Movement Speed"], tags: ["evasion", "movement"], offense: 1, defense: 6 },
            { id: "n_espool", name: "Energy Flow", stats: ["+15% maximum Energy Shield", "+20% faster Energy Shield Recharge"], tags: ["energyshield"], offense: 0, defense: 7 },
            { id: "n_resall", name: "Elemental Barrier", stats: ["+10% to all Elemental Resistances"], tags: ["resistance"], offense: 0, defense: 5 },
            { id: "n_regen", name: "Regeneration", stats: ["1% of Life Regenerated per second", "+10% Life Regeneration Rate"], tags: ["life", "regeneration"], offense: 0, defense: 5 },
            { id: "n_blockshield", name: "Shield Wall", stats: ["+15% Block Chance", "+30% Armour while holding Shield"], tags: ["block", "shield", "armour"], offense: 0, defense: 8 },
            { id: "n_fortify", name: "Fortification", stats: ["+20% Fortify Effect", "+5% chance to gain Fortify on Hit"], tags: ["fortify"], offense: 0, defense: 6 },
        ];
        
        // DoT notables
        const dotNotables = [
            { id: "n_bleeding", name: "Bloodletting", stats: ["+30% Damage with Bleeding", "+15% Bleed Duration"], tags: ["bleed", "physical", "dot"], offense: 7, defense: 0 },
            { id: "n_poisondmg", name: "Toxic Delivery", stats: ["+35% Poison Damage", "+20% Poison Duration"], tags: ["poison", "chaos", "dot"], offense: 7, defense: 0 },
            { id: "n_ignite", name: "Combustion", stats: ["+30% Damage with Ignite", "+25% Ignite Duration"], tags: ["ignite", "fire", "dot"], offense: 7, defense: 0 },
        ];
        
        // Minion notables
        const minionNotables = [
            { id: "n_minionlife", name: "Horde Life", stats: ["+25% Minion maximum Life", "+10% Minion Movement Speed"], tags: ["minion"], offense: 2, defense: 4 },
            { id: "n_miniondmg", name: "Puppet Master", stats: ["+30% Minion Damage", "+10% Minion Attack and Cast Speed"], tags: ["minion"], offense: 6, defense: 0 },
            { id: "n_zombies", name: "Lord of the Dead", stats: ["+1 maximum Zombie", "+20% Zombie Damage"], tags: ["minion", "zombie"], offense: 5, defense: 1 },
            { id: "n_skeletons", name: "Skeleton Mastery", stats: ["+1 maximum Skeletons", "+25% Skeleton Damage"], tags: ["minion", "skeleton"], offense: 6, defense: 0 },
        ];
        
        // Combine all notables
        const allNotables = [...physicalNotables, ...elementalNotables, ...rangedNotables, 
                            ...defenseNotables, ...dotNotables, ...minionNotables];
        
        // Add position and type to each
        allNotables.forEach((notable, index) => {
            notable.type = "notable";
            notable.position = {
                x: (index % 10) * 80 - 400,
                y: Math.floor(index / 10) * 80 - 300
            };
            this.notables[notable.id] = notable;
        });
    },
    
    generateSampleSmallNodes: function() {
        // Generate small stat nodes
        const smallNodeTypes = [
            { prefix: "str", name: "+10 Strength", stats: ["+10 to Strength"], tags: ["strength", "attribute"], offense: 1, defense: 1 },
            { prefix: "dex", name: "+10 Dexterity", stats: ["+10 to Dexterity"], tags: ["dexterity", "attribute"], offense: 1, defense: 1 },
            { prefix: "int", name: "+10 Intelligence", stats: ["+10 to Intelligence"], tags: ["intelligence", "attribute"], offense: 1, defense: 1 },
            
            { prefix: "phys", name: "+10% Physical Damage", stats: ["+10% Physical Damage"], tags: ["physical"], offense: 2, defense: 0 },
            { prefix: "fire", name: "+10% Fire Damage", stats: ["+10% Fire Damage"], tags: ["fire", "elemental"], offense: 2, defense: 0 },
            { prefix: "cold", name: "+10% Cold Damage", stats: ["+10% Cold Damage"], tags: ["cold", "elemental"], offense: 2, defense: 0 },
            { prefix: "light", name: "+10% Lightning Damage", stats: ["+10% Lightning Damage"], tags: ["lightning", "elemental"], offense: 2, defense: 0 },
            { prefix: "chaos", name: "+10% Chaos Damage", stats: ["+10% Chaos Damage"], tags: ["chaos"], offense: 2, defense: 0 },
            
            { prefix: "life", name: "+5% maximum Life", stats: ["+5% maximum Life"], tags: ["life"], offense: 0, defense: 2 },
            { prefix: "es", name: "+5% maximum Energy Shield", stats: ["+5% maximum Energy Shield"], tags: ["energyshield"], offense: 0, defense: 2 },
            { prefix: "mana", name: "+10% maximum Mana", stats: ["+10% maximum Mana"], tags: ["mana"], offense: 1, defense: 1 },
            
            { prefix: "arm", name: "+15% Armour", stats: ["+15% Armour"], tags: ["armour"], offense: 0, defense: 2 },
            { prefix: "eva", name: "+15% Evasion", stats: ["+15% Evasion Rating"], tags: ["evasion"], offense: 0, defense: 2 },
            
            { prefix: "atk", name: "+5% Attack Speed", stats: ["+5% Attack Speed"], tags: ["attack"], offense: 2, defense: 0 },
            { prefix: "cast", name: "+5% Cast Speed", stats: ["+5% Cast Speed"], tags: ["spell"], offense: 2, defense: 0 },
            { prefix: "crit", name: "+15% Critical Strike Chance", stats: ["+15% Critical Strike Chance"], tags: ["critical"], offense: 2, defense: 0 },
            
            { prefix: "minion", name: "+10% Minion Damage", stats: ["+10% Minion Damage"], tags: ["minion"], offense: 2, defense: 0 },
            
            { prefix: "res_fire", name: "+10% Fire Resistance", stats: ["+10% to Fire Resistance"], tags: ["resistance", "fire"], offense: 0, defense: 2 },
            { prefix: "res_cold", name: "+10% Cold Resistance", stats: ["+10% to Cold Resistance"], tags: ["resistance", "cold"], offense: 0, defense: 2 },
            { prefix: "res_light", name: "+10% Lightning Resistance", stats: ["+10% to Lightning Resistance"], tags: ["resistance", "lightning"], offense: 0, defense: 2 },
        ];
        
        // Generate multiple instances of each type
        let nodeIndex = 0;
        smallNodeTypes.forEach(nodeType => {
            for (let i = 1; i <= 8; i++) {
                const node = {
                    id: `s_${nodeType.prefix}_${i}`,
                    name: nodeType.name,
                    type: "small",
                    stats: [...nodeType.stats],
                    tags: [...nodeType.tags],
                    offense: nodeType.offense,
                    defense: nodeType.defense,
                    position: {
                        x: (nodeIndex % 20) * 50 - 500,
                        y: Math.floor(nodeIndex / 20) * 50 + 200
                    }
                };
                this.smallNodes[node.id] = node;
                nodeIndex++;
            }
        });
    },
    
    generateConnections: function() {
        // Generate graph connections for pathfinding
        // In a real implementation, this would come from the actual tree data
        
        // For the sample data, we'll create a simple grid-based connection scheme
        const allNodes = { ...this.keystones, ...this.notables, ...this.smallNodes };
        const nodeIds = Object.keys(allNodes);
        
        nodeIds.forEach(nodeId => {
            const node = allNodes[nodeId];
            this.connections[nodeId] = [];
            
            // Find nearby nodes based on position
            nodeIds.forEach(otherId => {
                if (nodeId === otherId) return;
                const other = allNodes[otherId];
                
                const dx = Math.abs(node.position.x - other.position.x);
                const dy = Math.abs(node.position.y - other.position.y);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Connect nodes within a certain distance
                if (distance < 100) {
                    this.connections[nodeId].push(otherId);
                }
            });
        });
        
        // Ensure connectivity for class starts
        Object.values(this.classes).forEach(cls => {
            this.connections[cls.startNode] = [];
            
            // Connect to nearby small nodes
            Object.keys(this.smallNodes).slice(0, 5).forEach(smallId => {
                this.connections[cls.startNode].push(smallId);
            });
        });
    },
    
    // Get all nodes
    getAllNodes: function() {
        return { ...this.keystones, ...this.notables, ...this.smallNodes };
    },
    
    // Get keystones list for dropdown
    getKeystonesList: function() {
        return Object.values(this.keystones).map(ks => ({
            id: ks.id,
            name: ks.name,
            stats: ks.stats,
            offense: ks.offense,
            defense: ks.defense
        }));
    },
    
    // Get class for ascendancy
    getClassForAscendancy: function(ascendancy) {
        const asc = this.ascendancies[ascendancy];
        return asc ? this.classes[asc.class] : null;
    },
    
    // Load tree data from JSON (POB format)
    loadFromJSON: function(jsonData) {
        try {
            // Parse POB tree.json format
            if (jsonData.nodes) {
                this.parsePobtreeNodes(jsonData.nodes);
            }
            if (jsonData.groups) {
                // Handle groups/clusters
            }
            this.isLoaded = true;
            return true;
        } catch (e) {
            console.error("Failed to load tree data:", e);
            return false;
        }
    },
    
    parsePobtreeNodes: function(nodes) {
        // Parse POB format nodes
        Object.keys(nodes).forEach(nodeId => {
            const pobNode = nodes[nodeId];
            
            // Determine node type
            let type = "small";
            if (pobNode.ks) type = "keystone";
            else if (pobNode.not) type = "notable";
            
            // Parse stats
            const stats = pobNode.sd || [];
            
            // Calculate offense/defense scores based on stats
            let offense = 0;
            let defense = 0;
            
            stats.forEach(stat => {
                const lowerStat = stat.toLowerCase();
                
                // Offense indicators
                if (lowerStat.includes('damage') || lowerStat.includes('critical') ||
                    lowerStat.includes('attack speed') || lowerStat.includes('cast speed') ||
                    lowerStat.includes('multiplier')) {
                    offense += type === 'keystone' ? 10 : type === 'notable' ? 5 : 2;
                }
                
                // Defense indicators
                if (lowerStat.includes('life') || lowerStat.includes('armour') ||
                    lowerStat.includes('evasion') || lowerStat.includes('energy shield') ||
                    lowerStat.includes('resistance') || lowerStat.includes('block')) {
                    defense += type === 'keystone' ? 10 : type === 'notable' ? 5 : 2;
                }
            });
            
            // Extract tags from stats
            const tags = this.extractTagsFromStats(stats);
            
            const node = {
                id: nodeId,
                name: pobNode.dn || `Node ${nodeId}`,
                type: type,
                stats: stats,
                tags: tags,
                offense: offense,
                defense: defense,
                position: { x: pobNode.x || 0, y: pobNode.y || 0 }
            };
            
            // Store in appropriate collection
            if (type === 'keystone') {
                this.keystones[nodeId] = node;
            } else if (type === 'notable') {
                this.notables[nodeId] = node;
            } else {
                this.smallNodes[nodeId] = node;
            }
            
            // Store connections
            if (pobNode.out) {
                this.connections[nodeId] = pobNode.out.map(String);
            }
        });
    },
    
    extractTagsFromStats: function(stats) {
        const tags = [];
        const tagKeywords = {
            'physical': ['physical'],
            'fire': ['fire'],
            'cold': ['cold', 'freeze', 'chill'],
            'lightning': ['lightning', 'shock'],
            'chaos': ['chaos', 'poison'],
            'elemental': ['elemental'],
            'attack': ['attack', 'melee', 'bow', 'axe', 'sword', 'mace'],
            'spell': ['spell', 'cast'],
            'minion': ['minion', 'zombie', 'skeleton', 'spectre'],
            'critical': ['critical'],
            'dot': ['damage over time', 'burning', 'bleed', 'poison'],
            'life': ['life'],
            'mana': ['mana'],
            'energyshield': ['energy shield'],
            'armour': ['armour', 'armor'],
            'evasion': ['evasion'],
            'resistance': ['resistance'],
            'aoe': ['area of effect', 'radius'],
            'projectile': ['projectile', 'arrow', 'bolt']
        };
        
        const statText = stats.join(' ').toLowerCase();
        
        Object.keys(tagKeywords).forEach(tag => {
            if (tagKeywords[tag].some(keyword => statText.includes(keyword))) {
                tags.push(tag);
            }
        });
        
        return tags;
    }
};

// Initialize sample data
POE2Data.init();
