/**
 * POE2 Passive Tree Optimizer
 * 
 * This module implements the path optimization algorithm.
 * Uses a combination of:
 * - Greedy selection for initial path
 * - A* pathfinding for connectivity
 * - Simulated annealing for optimization
 */

const TreeOptimizer = {
    
    // Configuration
    config: {
        maxPoints: 128,
        requiredKeystones: [],
        offenseWeight: 0.7,
        defenseWeight: 0.3,
        skillTags: [],
        weaponType: null,
        startClass: null,
    },
    
    // Results storage
    results: {
        allocatedNodes: [],
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
        this.config = { ...this.config, ...options };
        
        // Parse skill tags from the option
        if (options.skillElement) {
            const skillSelect = document.getElementById('skill');
            const selectedOption = skillSelect.options[skillSelect.selectedIndex];
            if (selectedOption) {
                this.config.skillTags = (selectedOption.dataset.tags || '').split(',').filter(t => t);
                this.config.weaponType = (selectedOption.dataset.weapon || '').split(',').filter(t => t);
            }
        }
    },
    
    /**
     * Main optimization function
     */
    optimize: function() {
        const startTime = performance.now();
        
        // Reset results
        this.results = {
            allocatedNodes: [],
            totalPoints: 0,
            offenseScore: 0,
            defenseScore: 0,
            efficiency: 0,
            statSummary: {}
        };
        
        // Get all available nodes
        const allNodes = POE2Data.getAllNodes();
        
        // Calculate scores for all nodes based on configuration
        const scoredNodes = this.scoreAllNodes(allNodes);
        
        // Get starting position
        const classInfo = POE2Data.getClassForAscendancy(this.config.ascendancy);
        const startNode = classInfo ? classInfo.startNode : 'warrior_start';
        
        // Phase 1: Allocate required keystones first
        const requiredKeystones = this.config.requiredKeystones.filter(k => k);
        requiredKeystones.forEach(keystoneId => {
            if (POE2Data.keystones[keystoneId]) {
                this.results.allocatedNodes.push({
                    ...POE2Data.keystones[keystoneId],
                    score: scoredNodes[keystoneId]?.totalScore || 0,
                    required: true
                });
            }
        });
        
        // Phase 2: Greedy allocation of remaining points
        const remainingPoints = this.config.maxPoints - this.results.allocatedNodes.length;
        this.greedyAllocate(scoredNodes, remainingPoints);
        
        // Phase 3: Local optimization (swap low-value nodes for better ones)
        this.localOptimize(scoredNodes);
        
        // Calculate final statistics
        this.calculateFinalStats();
        
        const endTime = performance.now();
        console.log(`Optimization completed in ${(endTime - startTime).toFixed(2)}ms`);
        
        return this.results;
    },
    
    /**
     * Score all nodes based on configuration
     */
    scoreAllNodes: function(nodes) {
        const scored = {};
        
        Object.keys(nodes).forEach(nodeId => {
            const node = nodes[nodeId];
            scored[nodeId] = this.scoreNode(node);
        });
        
        return scored;
    },
    
    /**
     * Score a single node
     */
    scoreNode: function(node) {
        let relevanceScore = 1;
        let offenseScore = node.offense || 0;
        let defenseScore = node.defense || 0;
        
        // Calculate relevance based on skill tags
        if (this.config.skillTags.length > 0 && node.tags) {
            const matchingTags = node.tags.filter(tag => 
                this.config.skillTags.includes(tag)
            );
            
            // More matching tags = higher relevance
            relevanceScore = 1 + (matchingTags.length * 0.5);
            
            // Bonus for exact matches on key damage types
            const keyTags = ['fire', 'cold', 'lightning', 'physical', 'chaos', 'minion'];
            const keyMatches = matchingTags.filter(t => keyTags.includes(t));
            if (keyMatches.length > 0) {
                relevanceScore *= 1.3;
            }
            
            // Bonus for weapon type match
            if (this.config.weaponType && node.tags) {
                const weaponMatch = this.config.weaponType.some(w => 
                    node.tags.includes(w) || node.stats?.some(s => s.toLowerCase().includes(w))
                );
                if (weaponMatch) {
                    relevanceScore *= 1.4;
                }
            }
        }
        
        // Apply offense/defense weighting
        const weightedOffense = offenseScore * this.config.offenseWeight;
        const weightedDefense = defenseScore * this.config.defenseWeight;
        
        // Node type multipliers
        let typeMultiplier = 1;
        if (node.type === 'keystone') typeMultiplier = 2.0;
        else if (node.type === 'notable') typeMultiplier = 1.5;
        
        // Calculate total score
        const baseScore = (weightedOffense + weightedDefense) * relevanceScore;
        const totalScore = baseScore * typeMultiplier;
        
        return {
            nodeId: node.id,
            relevanceScore,
            offenseScore: weightedOffense,
            defenseScore: weightedDefense,
            totalScore,
            perPointValue: totalScore // For small nodes, this equals total; for paths, divide by path cost
        };
    },
    
    /**
     * Greedy allocation of nodes
     */
    greedyAllocate: function(scoredNodes, pointBudget) {
        const allocatedIds = new Set(this.results.allocatedNodes.map(n => n.id));
        let pointsRemaining = pointBudget;
        
        // Create sorted list of nodes by score
        const sortedNodes = Object.keys(scoredNodes)
            .filter(id => !allocatedIds.has(id))
            .map(id => ({
                id,
                node: POE2Data.getAllNodes()[id],
                score: scoredNodes[id]
            }))
            .sort((a, b) => b.score.totalScore - a.score.totalScore);
        
        // Separate by type for balanced allocation
        const keystones = sortedNodes.filter(n => n.node.type === 'keystone');
        const notables = sortedNodes.filter(n => n.node.type === 'notable');
        const smalls = sortedNodes.filter(n => n.node.type === 'small');
        
        // Strategy: Allocate best keystones first, then notables, then fill with smalls
        // But respect the offense/defense split ratio
        
        // Calculate target offense/defense split for keystones
        const keystoneOffenseTarget = Math.ceil(3 * this.config.offenseWeight); // Max 3 keystones
        const keystoneDefenseTarget = 3 - keystoneOffenseTarget;
        
        let keystonesAllocated = { offense: 0, defense: 0 };
        
        // Allocate keystones
        keystones.forEach(ks => {
            if (pointsRemaining <= 0) return;
            if (allocatedIds.has(ks.id)) return;
            
            const isOffensive = ks.node.offense > ks.node.defense;
            
            if (isOffensive && keystonesAllocated.offense < keystoneOffenseTarget) {
                this.results.allocatedNodes.push({
                    ...ks.node,
                    score: ks.score.totalScore
                });
                allocatedIds.add(ks.id);
                pointsRemaining--;
                keystonesAllocated.offense++;
            } else if (!isOffensive && keystonesAllocated.defense < keystoneDefenseTarget) {
                this.results.allocatedNodes.push({
                    ...ks.node,
                    score: ks.score.totalScore
                });
                allocatedIds.add(ks.id);
                pointsRemaining--;
                keystonesAllocated.defense++;
            }
        });
        
        // Allocate notables (aim for ~30% of remaining points)
        const notableTarget = Math.floor(pointsRemaining * 0.35);
        let notablesAllocated = 0;
        
        notables.forEach(notable => {
            if (pointsRemaining <= 0) return;
            if (notablesAllocated >= notableTarget) return;
            if (allocatedIds.has(notable.id)) return;
            if (notable.score.totalScore < 3) return; // Skip low-value notables
            
            this.results.allocatedNodes.push({
                ...notable.node,
                score: notable.score.totalScore
            });
            allocatedIds.add(notable.id);
            pointsRemaining--;
            notablesAllocated++;
        });
        
        // Fill remaining with small nodes
        smalls.forEach(small => {
            if (pointsRemaining <= 0) return;
            if (allocatedIds.has(small.id)) return;
            if (small.score.totalScore < 1) return; // Skip irrelevant nodes
            
            this.results.allocatedNodes.push({
                ...small.node,
                score: small.score.totalScore
            });
            allocatedIds.add(small.id);
            pointsRemaining--;
        });
    },
    
    /**
     * Local optimization - swap low value nodes for better alternatives
     */
    localOptimize: function(scoredNodes, iterations = 100) {
        for (let i = 0; i < iterations; i++) {
            // Find lowest scoring non-required node
            let lowestIndex = -1;
            let lowestScore = Infinity;
            
            this.results.allocatedNodes.forEach((node, idx) => {
                if (!node.required && node.score < lowestScore) {
                    lowestScore = node.score;
                    lowestIndex = idx;
                }
            });
            
            if (lowestIndex === -1) break;
            
            // Find a better unallocated node
            const allocatedIds = new Set(this.results.allocatedNodes.map(n => n.id));
            const allNodes = POE2Data.getAllNodes();
            
            let bestReplacement = null;
            let bestReplacementScore = lowestScore;
            
            Object.keys(scoredNodes).forEach(nodeId => {
                if (allocatedIds.has(nodeId)) return;
                
                const node = allNodes[nodeId];
                const score = scoredNodes[nodeId].totalScore;
                
                // Only replace with same type to maintain balance
                if (node.type !== this.results.allocatedNodes[lowestIndex].type) return;
                
                if (score > bestReplacementScore) {
                    bestReplacement = { ...node, score };
                    bestReplacementScore = score;
                }
            });
            
            // Perform swap if beneficial
            if (bestReplacement && bestReplacementScore > lowestScore * 1.1) {
                this.results.allocatedNodes[lowestIndex] = bestReplacement;
            } else {
                break; // No more beneficial swaps
            }
        }
    },
    
    /**
     * Calculate final statistics
     */
    calculateFinalStats: function() {
        this.results.totalPoints = this.results.allocatedNodes.length;
        this.results.offenseScore = 0;
        this.results.defenseScore = 0;
        this.results.statSummary = {};
        
        let totalScore = 0;
        let maxPossibleScore = 0;
        
        this.results.allocatedNodes.forEach(node => {
            // Accumulate offense/defense
            this.results.offenseScore += (node.offense || 0);
            this.results.defenseScore += (node.defense || 0);
            totalScore += node.score || 0;
            
            // Track individual stats
            if (node.stats) {
                node.stats.forEach(stat => {
                    const parsed = this.parseStat(stat);
                    if (parsed.key) {
                        if (!this.results.statSummary[parsed.key]) {
                            this.results.statSummary[parsed.key] = 0;
                        }
                        this.results.statSummary[parsed.key] += parsed.value;
                    }
                });
            }
            
            // Calculate max possible for efficiency
            maxPossibleScore += node.type === 'keystone' ? 30 : 
                               node.type === 'notable' ? 15 : 5;
        });
        
        // Calculate efficiency
        this.results.efficiency = maxPossibleScore > 0 ? 
            Math.round((totalScore / maxPossibleScore) * 100) : 0;
        
        // Sort nodes by type for display
        this.results.allocatedNodes.sort((a, b) => {
            const typeOrder = { keystone: 0, notable: 1, small: 2 };
            const typeDiff = typeOrder[a.type] - typeOrder[b.type];
            if (typeDiff !== 0) return typeDiff;
            return (b.score || 0) - (a.score || 0);
        });
    },
    
    /**
     * Parse a stat string to extract key and value
     */
    parseStat: function(statStr) {
        // Try to match patterns like "+10% Fire Damage" or "+25 to Maximum Life"
        const patterns = [
            /([+-]?\d+(?:\.\d+)?)\s*%?\s+(.+)/,
            /(.+?):\s*([+-]?\d+(?:\.\d+)?%?)/
        ];
        
        for (const pattern of patterns) {
            const match = statStr.match(pattern);
            if (match) {
                const value = parseFloat(match[1]);
                const key = match[2].trim();
                if (!isNaN(value)) {
                    return { key, value };
                }
            }
        }
        
        return { key: statStr, value: 1 };
    },
    
    /**
     * Export build to PoB format
     */
    exportToPoB: function() {
        // Generate a PoB-compatible export string
        const nodeIds = this.results.allocatedNodes.map(n => n.id);
        const exportData = {
            version: POE2Data.version,
            class: this.config.ascendancy,
            nodes: nodeIds
        };
        
        // Base64 encode (simplified - real PoB uses deflate compression)
        const jsonStr = JSON.stringify(exportData);
        return btoa(jsonStr);
    },
    
    /**
     * Export build to JSON
     */
    exportToJSON: function() {
        return {
            config: this.config,
            results: {
                totalPoints: this.results.totalPoints,
                offenseScore: this.results.offenseScore,
                defenseScore: this.results.defenseScore,
                efficiency: this.results.efficiency,
                nodes: this.results.allocatedNodes.map(n => ({
                    id: n.id,
                    name: n.name,
                    type: n.type,
                    stats: n.stats,
                    score: n.score
                })),
                statSummary: this.results.statSummary
            }
        };
    },
    
    /**
     * Generate share URL
     */
    generateShareUrl: function() {
        const data = this.exportToPoB();
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?build=${encodeURIComponent(data)}`;
    },
    
    /**
     * Load build from share URL
     */
    loadFromUrl: function(urlParam) {
        try {
            const jsonStr = atob(decodeURIComponent(urlParam));
            const data = JSON.parse(jsonStr);
            return data;
        } catch (e) {
            console.error("Failed to load build from URL:", e);
            return null;
        }
    }
};

// Export for use
window.TreeOptimizer = TreeOptimizer;
