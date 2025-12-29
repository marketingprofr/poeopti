/**
 * POE2 Passive Tree Optimizer - FIXED VERSION
 * 
 * Key features:
 * 1. GUARANTEES connectivity - all nodes are connected via pathfinding
 * 2. Proper tag matching - penalizes WRONG damage types heavily
 * 3. Working export format
 */

const TreeOptimizer = {
    
    config: {
        maxPoints: 128,
        requiredKeystones: [],
        offenseWeight: 0.7,
        defenseWeight: 0.3,
        skillTags: [],
        weaponTypes: [],
        startNodeId: null,
        className: null,
    },
    
    results: {
        allocatedNodes: [],
        allocatedIds: new Set(),
        totalPoints: 0,
        offenseScore: 0,
        defenseScore: 0,
        efficiency: 0,
        statSummary: {}
    },
    
    /**
     * Configure the optimizer
     */
    configure: function(options) {
        // Get class from ascendancy
        const className = POE2Data.getClassForAscendancy(options.ascendancy);
        
        // Get skill tags from the select element
        const skillSelect = document.getElementById('skill');
        const selectedOption = skillSelect?.options[skillSelect.selectedIndex];
        const skillTags = selectedOption ? 
            (selectedOption.dataset.tags || '').split(',').filter(t => t.trim()) : [];
        const weaponTypes = selectedOption ? 
            (selectedOption.dataset.weapon || '').split(',').filter(t => t.trim()) : [];
        
        // Find start node
        const startNodeId = POE2Data.getClassStartNode(className);
        
        this.config = {
            maxPoints: options.maxPoints || 128,
            requiredKeystones: (options.requiredKeystones || []).filter(k => k),
            offenseWeight: options.offenseWeight || 0.7,
            defenseWeight: options.defenseWeight || 0.3,
            skillTags: skillTags,
            weaponTypes: weaponTypes,
            startNodeId: startNodeId,
            className: className,
            ascendancy: options.ascendancy
        };
        
        console.log("Optimizer configured:", {
            class: className,
            startNode: startNodeId,
            skillTags: skillTags,
            weaponTypes: weaponTypes,
            requiredKeystones: this.config.requiredKeystones
        });
    },
    
    /**
     * Main optimization function
     */
    optimize: function() {
        const startTime = performance.now();
        
        // Reset results
        this.results = {
            allocatedNodes: [],
            allocatedIds: new Set(),
            totalPoints: 0,
            offenseScore: 0,
            defenseScore: 0,
            efficiency: 0,
            statSummary: {}
        };
        
        // Validate start node
        if (!this.config.startNodeId) {
            console.error("No start node found!");
            return this.results;
        }
        
        console.log("Starting from node:", this.config.startNodeId);
        
        // Step 1: Allocate starting node
        this.allocateNode(this.config.startNodeId);
        
        // Step 2: Path to required keystones first
        for (const keystoneId of this.config.requiredKeystones) {
            if (!keystoneId || !POE2Data.keystones[keystoneId]) continue;
            if (this.results.totalPoints >= this.config.maxPoints) break;
            
            console.log("Pathing to required keystone:", POE2Data.keystones[keystoneId].name);
            this.pathToNode(keystoneId);
        }
        
        // Step 3: Greedy expansion - always pick best CONNECTED node
        let iterations = 0;
        const maxIterations = this.config.maxPoints * 10; // Safety limit
        
        while (this.results.totalPoints < this.config.maxPoints && iterations < maxIterations) {
            iterations++;
            
            const bestTarget = this.findBestTarget();
            if (!bestTarget) {
                console.log("No more good targets found");
                break;
            }
            
            // Allocate the path to this node
            if (!this.pathToNode(bestTarget.id)) {
                console.log("Could not path to:", bestTarget.name);
                continue;
            }
        }
        
        // Calculate final stats
        this.calculateFinalStats();
        
        const endTime = performance.now();
        console.log(`Optimization completed in ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`Allocated ${this.results.totalPoints} nodes`);
        
        return this.results;
    },
    
    /**
     * Allocate a single node
     */
    allocateNode: function(nodeId) {
        nodeId = String(nodeId);
        
        if (this.results.allocatedIds.has(nodeId)) return false;
        if (this.results.totalPoints >= this.config.maxPoints) return false;
        
        // Get node from any category
        const node = POE2Data.allNodes[nodeId];
        if (!node) {
            console.warn("Node not found:", nodeId);
            return false;
        }
        
        const score = this.scoreNode(node);
        
        this.results.allocatedIds.add(nodeId);
        this.results.allocatedNodes.push({
            ...node,
            score: score.total,
            offenseContrib: score.offense,
            defenseContrib: score.defense,
            relevance: score.relevance
        });
        this.results.totalPoints++;
        
        return true;
    },
    
    /**
     * Path to a node and allocate all nodes along the way
     * Returns true if successful
     */
    pathToNode: function(targetId) {
        targetId = String(targetId);
        
        if (this.results.allocatedIds.has(targetId)) return true;
        
        // Find path from any allocated node to target
        const path = this.findPathFromAllocated(targetId);
        
        if (!path || path.length === 0) {
            console.warn("No path found to node:", targetId);
            return false;
        }
        
        // Check if we have enough points
        const pointsNeeded = path.filter(id => !this.results.allocatedIds.has(id)).length;
        if (this.results.totalPoints + pointsNeeded > this.config.maxPoints) {
            return false;
        }
        
        // Allocate all nodes in path
        for (const nodeId of path) {
            if (!this.allocateNode(nodeId)) {
                return false;
            }
        }
        
        return true;
    },
    
    /**
     * Find shortest path from any allocated node to target
     */
    findPathFromAllocated: function(targetId) {
        targetId = String(targetId);
        
        if (this.results.allocatedIds.has(targetId)) return [];
        
        // BFS from all allocated nodes simultaneously
        const visited = new Set(this.results.allocatedIds);
        const queue = [];
        
        // Initialize with neighbors of all allocated nodes
        for (const allocatedId of this.results.allocatedIds) {
            const neighbors = POE2Data.getNeighbors(allocatedId);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push({ nodeId: neighbor, path: [neighbor] });
                }
            }
        }
        
        while (queue.length > 0) {
            const { nodeId, path } = queue.shift();
            
            if (nodeId === targetId) {
                return path;
            }
            
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            
            const neighbors = POE2Data.getNeighbors(nodeId);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push({ nodeId: neighbor, path: [...path, neighbor] });
                }
            }
        }
        
        return null;
    },
    
    /**
     * Find the best target node to path towards
     */
    findBestTarget: function() {
        // Get all valuable nodes we haven't allocated
        const candidates = [];
        const valuableNodes = POE2Data.getValuableNodes();
        
        for (const nodeId in valuableNodes) {
            if (this.results.allocatedIds.has(nodeId)) continue;
            
            const node = valuableNodes[nodeId];
            const score = this.scoreNode(node);
            
            // Skip nodes with very low relevance (wrong damage type etc)
            if (score.relevance < 0.3) continue;
            
            // Calculate path cost
            const path = this.findPathFromAllocated(nodeId);
            if (!path) continue;
            
            const pathCost = path.length;
            if (pathCost === 0) continue;
            
            // Check if we can afford it
            if (this.results.totalPoints + pathCost > this.config.maxPoints) continue;
            
            // Value = score / cost (efficiency)
            const efficiency = score.total / pathCost;
            
            candidates.push({
                id: nodeId,
                name: node.name,
                type: node.type,
                score: score.total,
                pathCost: pathCost,
                efficiency: efficiency,
                relevance: score.relevance
            });
        }
        
        if (candidates.length === 0) return null;
        
        // Sort by efficiency (best value per point spent)
        candidates.sort((a, b) => {
            // Prefer higher relevance first
            if (Math.abs(a.relevance - b.relevance) > 0.3) {
                return b.relevance - a.relevance;
            }
            // Then by efficiency
            return b.efficiency - a.efficiency;
        });
        
        return candidates[0];
    },
    
    /**
     * Score a node based on skill compatibility
     * CRITICAL: This properly penalizes wrong damage types
     */
    scoreNode: function(node) {
        const nodeTags = node.tags || [];
        const skillTags = this.config.skillTags;
        
        let relevance = 1.0;
        
        // === CONFLICT DETECTION ===
        
        // Attack vs Spell (MAJOR conflict)
        const nodeIsSpell = nodeTags.includes('spell');
        const nodeIsAttack = nodeTags.includes('attack') || nodeTags.includes('melee');
        const skillIsSpell = skillTags.includes('spell');
        const skillIsAttack = skillTags.includes('attack') || skillTags.includes('melee') || 
                             skillTags.includes('bow') || skillTags.includes('crossbow');
        
        if (nodeIsSpell && skillIsAttack && !skillIsSpell) {
            relevance *= 0.05; // Spell nodes for attack builds = almost useless
        }
        if (nodeIsAttack && skillIsSpell && !skillIsAttack) {
            relevance *= 0.05; // Attack nodes for spell builds = almost useless
        }
        
        // Melee vs Ranged (MAJOR conflict)
        const nodeIsMelee = nodeTags.includes('melee');
        const nodeIsRanged = nodeTags.includes('bow') || nodeTags.includes('crossbow') || nodeTags.includes('projectile');
        const skillIsMelee = skillTags.includes('melee') || skillTags.includes('strike') || skillTags.includes('slam');
        const skillIsRanged = skillTags.includes('bow') || skillTags.includes('crossbow') || skillTags.includes('projectile');
        
        if (nodeIsMelee && skillIsRanged && !skillIsMelee) {
            relevance *= 0.05;
        }
        if (nodeIsRanged && skillIsMelee && !skillIsRanged) {
            relevance *= 0.05;
        }
        
        // Damage type conflict
        const damageTypes = ['physical', 'fire', 'cold', 'lightning', 'chaos'];
        const nodeDamageTypes = damageTypes.filter(t => nodeTags.includes(t));
        const skillDamageTypes = damageTypes.filter(t => skillTags.includes(t));
        
        if (nodeDamageTypes.length > 0 && skillDamageTypes.length > 0) {
            const matches = nodeDamageTypes.filter(t => skillDamageTypes.includes(t));
            if (matches.length === 0) {
                // Node has damage type that skill doesn't use
                relevance *= 0.1;
            } else {
                // Matching damage type = bonus
                relevance *= 1.3;
            }
        }
        
        // Weapon type conflict
        const weaponTypes = ['sword', 'axe', 'mace', 'bow', 'crossbow', 'staff', 'wand', 'claw', 'dagger'];
        const nodeWeapons = weaponTypes.filter(t => nodeTags.includes(t));
        const skillWeapons = this.config.weaponTypes;
        
        if (nodeWeapons.length > 0 && skillWeapons.length > 0) {
            const matches = nodeWeapons.filter(t => skillWeapons.includes(t));
            if (matches.length === 0) {
                relevance *= 0.1;
            } else {
                relevance *= 1.4;
            }
        }
        
        // Minion conflict
        const nodeIsMinion = nodeTags.includes('minion');
        const skillIsMinion = skillTags.includes('minion');
        
        if (nodeIsMinion && !skillIsMinion) {
            relevance *= 0.02; // Minion nodes for non-minion = useless
        }
        if (!nodeIsMinion && skillIsMinion && (nodeIsAttack || nodeIsSpell)) {
            relevance *= 0.2; // Self-damage for minion builds = less useful
        }
        
        // === POSITIVE MATCHING ===
        
        // Tag matches
        const matches = nodeTags.filter(t => skillTags.includes(t));
        if (matches.length > 0) {
            relevance *= (1 + matches.length * 0.15);
        }
        
        // === CALCULATE SCORES ===
        
        const baseOffense = (node.offense || 0) * this.config.offenseWeight;
        const baseDefense = (node.defense || 0) * this.config.defenseWeight;
        
        // Apply relevance to offense (defense is always useful)
        const offense = baseOffense * relevance;
        const defense = baseDefense;
        
        // Type multipliers
        let typeMult = 1;
        if (node.type === 'keystone') typeMult = 3;
        else if (node.type === 'notable') typeMult = 2;
        
        const total = (offense + defense) * typeMult;
        
        return {
            offense: offense,
            defense: defense,
            relevance: relevance,
            total: Math.max(0.01, total) // Minimum score for travel
        };
    },
    
    /**
     * Calculate final stats
     */
    calculateFinalStats: function() {
        this.results.offenseScore = 0;
        this.results.defenseScore = 0;
        this.results.statSummary = {};
        
        let totalScore = 0;
        
        this.results.allocatedNodes.forEach(node => {
            this.results.offenseScore += (node.offenseContrib || 0);
            this.results.defenseScore += (node.defenseContrib || 0);
            totalScore += (node.score || 0);
            
            // Aggregate stats
            (node.stats || []).forEach(stat => {
                const match = stat.match(/([+-]?\d+(?:\.\d+)?)/);
                if (match) {
                    const key = stat.replace(match[0], '#').trim();
                    if (!this.results.statSummary[key]) {
                        this.results.statSummary[key] = 0;
                    }
                    this.results.statSummary[key] += parseFloat(match[1]);
                }
            });
        });
        
        // Efficiency calculation
        const maxPossible = this.results.totalPoints * 5;
        this.results.efficiency = maxPossible > 0 ? 
            Math.min(100, Math.round((totalScore / maxPossible) * 100)) : 0;
        
        // Sort nodes: keystones > notables > small
        this.results.allocatedNodes.sort((a, b) => {
            const order = { keystone: 0, notable: 1, small: 2 };
            const typeDiff = (order[a.type] || 3) - (order[b.type] || 3);
            if (typeDiff !== 0) return typeDiff;
            return (b.score || 0) - (a.score || 0);
        });
    },
    
    /**
     * Export node IDs as comma-separated string
     */
    exportNodeList: function() {
        return Array.from(this.results.allocatedIds)
            .map(id => parseInt(id))
            .filter(id => !isNaN(id))
            .sort((a, b) => a - b)
            .join(',');
    },
    
    /**
     * Export as JSON
     */
    exportToJSON: function() {
        return {
            config: {
                ascendancy: this.config.ascendancy,
                class: this.config.className,
                skill: this.config.skillTags.join(','),
                weapons: this.config.weaponTypes.join(','),
                offenseWeight: this.config.offenseWeight,
                maxPoints: this.config.maxPoints
            },
            results: {
                totalPoints: this.results.totalPoints,
                offenseScore: Math.round(this.results.offenseScore * 10) / 10,
                defenseScore: Math.round(this.results.defenseScore * 10) / 10,
                efficiency: this.results.efficiency,
                nodeIds: Array.from(this.results.allocatedIds),
                keystones: this.results.allocatedNodes
                    .filter(n => n.type === 'keystone')
                    .map(n => ({ id: n.id, name: n.name, stats: n.stats })),
                notables: this.results.allocatedNodes
                    .filter(n => n.type === 'notable')
                    .map(n => ({ id: n.id, name: n.name, stats: n.stats })),
                statSummary: this.results.statSummary
            }
        };
    },
    
    /**
     * Generate PoEPlanner-style URL
     */
    generatePlannerUrl: function() {
        const nodeIds = Array.from(this.results.allocatedIds)
            .map(id => parseInt(id))
            .filter(id => !isNaN(id));
        
        // Base64 encode the node list
        const data = {
            v: POE2Data.version,
            c: this.config.className,
            n: nodeIds
        };
        
        const encoded = btoa(JSON.stringify(data));
        return encoded;
    }
};

window.TreeOptimizer = TreeOptimizer;
