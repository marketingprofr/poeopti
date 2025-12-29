/**
 * POE2 Passive Tree Optimizer - Application Logic
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    App.init();
});

const App = {
    // Current state
    state: {
        isLoading: false,
        hasRealData: false
    },
    
    /**
     * Initialize the application
     */
    init: function() {
        this.bindEvents();
        this.populateKeystones();
        this.updateSkillInfo();
        this.checkUrlParams();
    },
    
    /**
     * Bind all event listeners
     */
    bindEvents: function() {
        // Main form elements
        document.getElementById('ascendancy').addEventListener('change', () => {
            this.updateKeystoneOptions();
        });
        
        document.getElementById('skill').addEventListener('change', () => {
            this.updateSkillInfo();
        });
        
        document.getElementById('offenseDefense').addEventListener('input', (e) => {
            document.getElementById('splitValue').textContent = e.target.value + '%';
        });
        
        // Optimize button
        document.getElementById('optimizeBtn').addEventListener('click', () => {
            this.runOptimization();
        });
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Export buttons
        document.getElementById('exportPoB').addEventListener('click', () => {
            this.exportPoB();
        });
        
        document.getElementById('exportJson').addEventListener('click', () => {
            this.exportJSON();
        });
        
        document.getElementById('exportUrl').addEventListener('click', () => {
            this.exportUrl();
        });
        
        // Data loading
        document.getElementById('loadDataBtn').addEventListener('click', () => {
            document.getElementById('dataFileInput').click();
        });
        
        document.getElementById('dataFileInput').addEventListener('change', (e) => {
            this.loadDataFile(e.target.files[0]);
        });
    },
    
    /**
     * Populate keystones dropdowns
     */
    populateKeystones: function() {
        const keystones = POE2Data.getKeystonesList();
        const selects = ['keystone1', 'keystone2', 'keystone3'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">-- None --</option>';
            
            if (keystones.length === 0) {
                const placeholder = document.createElement('option');
                placeholder.disabled = true;
                placeholder.textContent = '(Load tree.json first)';
                select.appendChild(placeholder);
                return;
            }
            
            // Group by offense/defense
            const offenseGroup = document.createElement('optgroup');
            offenseGroup.label = 'Offense';
            
            const defenseGroup = document.createElement('optgroup');
            defenseGroup.label = 'Defense';
            
            const hybridGroup = document.createElement('optgroup');
            hybridGroup.label = 'Hybrid';
            
            keystones.forEach(ks => {
                const option = document.createElement('option');
                option.value = ks.id;
                option.textContent = ks.name;
                option.title = ks.stats.join('\n');
                
                if (ks.offense > ks.defense + 2) {
                    offenseGroup.appendChild(option);
                } else if (ks.defense > ks.offense + 2) {
                    defenseGroup.appendChild(option);
                } else {
                    hybridGroup.appendChild(option);
                }
            });
            
            if (offenseGroup.children.length > 0) select.appendChild(offenseGroup);
            if (defenseGroup.children.length > 0) select.appendChild(defenseGroup);
            if (hybridGroup.children.length > 0) select.appendChild(hybridGroup);
        });
        
        // Update UI based on data state
        this.updateDataStatus();
    },
    
    /**
     * Update UI to show data loading status
     */
    updateDataStatus: function() {
        const noDataWarning = document.getElementById('noDataWarning');
        const optimizeBtn = document.getElementById('optimizeBtn');
        
        if (POE2Data.isLoaded) {
            noDataWarning.classList.add('hidden');
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<span class="btn-icon">⚡</span> Optimize Tree';
        } else {
            noDataWarning.classList.remove('hidden');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<span class="btn-icon">⚠️</span> Load Tree Data First';
        }
    },
    
    /**
     * Update keystone options based on ascendancy (filter incompatible ones)
     */
    updateKeystoneOptions: function() {
        // For now, all keystones are available to all classes
        // This can be extended to filter based on class/position
    },
    
    /**
     * Update skill info display
     */
    updateSkillInfo: function() {
        const skillSelect = document.getElementById('skill');
        const selectedOption = skillSelect.options[skillSelect.selectedIndex];
        const skillInfo = document.getElementById('skillInfo');
        
        if (selectedOption && selectedOption.dataset.tags) {
            const tags = selectedOption.dataset.tags.split(',');
            const weapons = selectedOption.dataset.weapon?.split(',') || [];
            
            skillInfo.innerHTML = `
                <strong>Tags:</strong> ${tags.join(', ')}<br>
                <strong>Weapons:</strong> ${weapons.join(', ')}
            `;
        } else {
            skillInfo.textContent = '';
        }
    },
    
    /**
     * Run the optimization
     */
    runOptimization: function() {
        if (this.state.isLoading) return;
        
        // Check if data is loaded
        if (!POE2Data.isLoaded) {
            this.showToast('Please load tree.json first!');
            return;
        }
        
        const nodeCount = Object.keys(POE2Data.getAllNodes()).length;
        if (nodeCount === 0) {
            this.showToast('No nodes loaded. Please check your tree.json file.');
            return;
        }
        
        this.state.isLoading = true;
        this.showLoading(true);
        
        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            try {
                // Gather configuration
                const config = {
                    ascendancy: document.getElementById('ascendancy').value,
                    skillElement: document.getElementById('skill').value,
                    offenseWeight: parseInt(document.getElementById('offenseDefense').value) / 100,
                    defenseWeight: 1 - (parseInt(document.getElementById('offenseDefense').value) / 100),
                    requiredKeystones: [
                        document.getElementById('keystone1').value,
                        document.getElementById('keystone2').value,
                        document.getElementById('keystone3').value
                    ],
                    maxPoints: parseInt(document.getElementById('pointBudget').value) || 128
                };
                
                // Configure and run optimizer
                TreeOptimizer.configure(config);
                const results = TreeOptimizer.optimize();
                
                // Display results
                this.displayResults(results);
                
            } catch (error) {
                console.error('Optimization failed:', error);
                alert('Optimization failed: ' + error.message);
            } finally {
                this.state.isLoading = false;
                this.showLoading(false);
            }
        }, 50);
    },
    
    /**
     * Show/hide loading indicator
     */
    showLoading: function(show) {
        document.getElementById('loadingIndicator').classList.toggle('hidden', !show);
        document.getElementById('results').classList.toggle('hidden', show);
    },
    
    /**
     * Display optimization results
     */
    displayResults: function(results) {
        // Update summary stats
        document.getElementById('totalPoints').textContent = results.totalPoints;
        document.getElementById('offenseScore').textContent = results.offenseScore.toFixed(1);
        document.getElementById('defenseScore').textContent = results.defenseScore.toFixed(1);
        document.getElementById('efficiency').textContent = results.efficiency + '%';
        
        // Display stat summary
        this.displayStatSummary(results.statSummary);
        
        // Display node list (default to keystones tab)
        this.switchTab('keystones');
        this.displayNodes(results.allocatedNodes);
        
        // Show results panel
        document.getElementById('results').classList.remove('hidden');
    },
    
    /**
     * Display stat summary
     */
    displayStatSummary: function(stats) {
        const container = document.getElementById('statsList');
        container.innerHTML = '';
        
        // Sort stats by value
        const sortedStats = Object.entries(stats)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 20); // Top 20 stats
        
        sortedStats.forEach(([key, value]) => {
            const div = document.createElement('div');
            div.className = 'stat-item';
            div.innerHTML = `
                <span class="stat-name">${this.formatStatName(key)}</span>
                <span class="stat-value">${this.formatStatValue(value)}</span>
            `;
            container.appendChild(div);
        });
    },
    
    /**
     * Format stat name for display
     */
    formatStatName: function(name) {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    },
    
    /**
     * Format stat value for display
     */
    formatStatValue: function(value) {
        if (Number.isInteger(value)) {
            return value > 0 ? '+' + value : value.toString();
        }
        return (value > 0 ? '+' : '') + value.toFixed(1);
    },
    
    /**
     * Switch between node tabs
     */
    switchTab: function(tabName) {
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Filter and display nodes
        const results = TreeOptimizer.results;
        if (results && results.allocatedNodes) {
            const filtered = results.allocatedNodes.filter(node => {
                if (tabName === 'keystones') return node.type === 'keystone';
                if (tabName === 'notables') return node.type === 'notable';
                if (tabName === 'small') return node.type === 'small';
                return true;
            });
            this.displayNodes(filtered);
        }
    },
    
    /**
     * Display nodes in the list
     */
    displayNodes: function(nodes) {
        const container = document.getElementById('nodeListContent');
        container.innerHTML = '';
        
        if (nodes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">No nodes of this type allocated.</p>';
            return;
        }
        
        nodes.forEach((node, index) => {
            const div = document.createElement('div');
            div.className = 'node-item';
            div.innerHTML = `
                <span class="node-index">${index + 1}</span>
                <div class="node-info">
                    <div class="node-name ${node.type}">${node.name}</div>
                    <div class="node-stats">${(node.stats || []).join(' | ')}</div>
                </div>
                <div class="node-score">
                    <div class="offense">Off: ${node.offense || 0}</div>
                    <div class="defense">Def: ${node.defense || 0}</div>
                </div>
            `;
            container.appendChild(div);
        });
    },
    
    /**
     * Export to PoB format - show node IDs for manual entry
     */
    exportPoB: function() {
        if (TreeOptimizer.results.totalPoints === 0) {
            this.showToast('Run optimization first!');
            return;
        }
        
        const results = TreeOptimizer.results;
        const nodeList = TreeOptimizer.exportNodeList();
        
        // Get keystones and notables for summary
        const keystones = results.allocatedNodes.filter(n => n.type === 'keystone' && !n.isStub);
        const notables = results.allocatedNodes.filter(n => n.type === 'notable' && !n.isStub);
        
        // Class mapping for PoB (POE2 classes)
        const classMap = {
            'warrior': { id: 1, name: 'Warrior' },
            'marauder': { id: 2, name: 'Marauder' },
            'ranger': { id: 3, name: 'Ranger' },
            'mercenary': { id: 4, name: 'Mercenary' },
            'sorceress': { id: 5, name: 'Sorceress' },
            'witch': { id: 6, name: 'Witch' },
            'monk': { id: 7, name: 'Monk' }
        };
        
        const classInfo = classMap[TreeOptimizer.config.className?.toLowerCase()] || { id: 1, name: 'Warrior' };
        
        // Generate PoB XML in the correct format
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
	<Build level="90" targetVersion="2_0" className="${classInfo.name}" ascendClassName="None" mainSocketGroup="1" viewMode="TREE">
	</Build>
	<Tree activeSpec="1">
		<Spec treeVersion="2_0" classId="${classInfo.id}" ascendClassId="0" nodes="${nodeList}">
		</Spec>
	</Tree>
	<Notes>Build generated by POE2 Tree Optimizer
Keystones: ${keystones.map(n => n.name).join(', ') || 'none'}
Notables: ${notables.length}
Total Points: ${results.totalPoints}</Notes>
	<TreeView searchStr="" zoomY="0" showHeatMap="false" zoomLevel="3" showStatDifferences="true" zoomX="0"/>
	<Skills>
	</Skills>
	<Items>
	</Items>
</PathOfBuilding>`;
        
        // Compress with zlib and encode to base64
        let pobCode = null;
        try {
            if (typeof pako !== 'undefined') {
                // Compress with zlib (deflate with header, level 9)
                const compressed = pako.deflate(xml, { level: 9 });
                
                // Convert to base64 with URL-safe characters
                let binary = '';
                for (let i = 0; i < compressed.length; i++) {
                    binary += String.fromCharCode(compressed[i]);
                }
                pobCode = btoa(binary)
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_');
                    
                console.log("Generated PoB code length:", pobCode.length);
            }
        } catch (e) {
            console.error("Compression failed:", e);
        }
        
        // Copy to clipboard
        if (pobCode) {
            this.copyToClipboard(pobCode);
        }
        
        // Show modal
        const modal = document.createElement('div');
        modal.className = 'export-modal';
        modal.innerHTML = `
            <div class="export-modal-content" style="max-width: 700px;">
                <h3>📋 Export to Path of Building</h3>
                
                ${pobCode ? `
                <div class="export-section" style="background: rgba(0,255,0,0.1); border: 1px solid #0f0; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #0f0;">✅ PoB Code Generated (Copied to clipboard!)</h4>
                    <textarea readonly class="node-list-display" style="height: 100px; font-size: 11px;" id="pobCodeArea">${pobCode}</textarea>
                    <button class="btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById('pobCodeArea').value); App.showToast('Copied!');">Copy Code</button>
                </div>
                
                <div class="export-instructions">
                    <h4>How to import in Path of Building 2:</h4>
                    <ol>
                        <li>Open <strong>Path of Building 2</strong></li>
                        <li>Click <strong>"Import/Export Build"</strong> (top left)</li>
                        <li>In the "Build Sharing" section, paste the code</li>
                        <li>Click <strong>"Import"</strong></li>
                    </ol>
                </div>
                ` : `
                <div class="export-section" style="background: rgba(255,0,0,0.1); border: 1px solid #f00; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #f00;">❌ Could not generate PoB code</h4>
                    <p>The pako compression library failed to load.</p>
                </div>
                `}
                
                <div class="export-section">
                    <h4>📊 Build Summary</h4>
                    <div style="color: var(--text-secondary);">
                        <p><strong>Class:</strong> ${classInfo.name}</p>
                        <p><strong>Points:</strong> ${results.totalPoints}</p>
                        <p><strong>Keystones (${keystones.length}):</strong> ${keystones.map(n => n.name).join(', ') || 'none'}</p>
                        <p><strong>Notables:</strong> ${notables.length}</p>
                    </div>
                </div>
                
                <div class="export-section">
                    <h4>📝 Node IDs (backup)</h4>
                    <textarea readonly class="node-list-display" style="height: 60px;" id="nodeIdsArea">${nodeList}</textarea>
                    <button class="btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById('nodeIdsArea').value); App.showToast('Copied!');">Copy IDs</button>
                </div>
                
                <button class="btn-primary" onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        this.showToast(pobCode ? 'PoB code copied!' : 'Export generated');
    },
    
    /**
     * Export to JSON
     */
    exportJSON: function() {
        const data = TreeOptimizer.exportToJSON();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'poe2-build-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Export share URL
     */
    exportUrl: function() {
        if (TreeOptimizer.results.totalPoints === 0) {
            this.showToast('Run optimization first!');
            return;
        }
        const url = TreeOptimizer.generateShareUrl();
        this.copyToClipboard(url);
        this.showToast('Share URL copied to clipboard!');
    },
    
    /**
     * Copy text to clipboard
     */
    copyToClipboard: function(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    },
    
    /**
     * Show a toast notification
     */
    showToast: function(message) {
        // Create toast element
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent-gold);
            color: var(--bg-dark);
            padding: 12px 24px;
            border-radius: 4px;
            font-weight: 600;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    },
    
    /**
     * Load tree data from file
     */
    loadDataFile: function(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Debug: log the structure
                console.log("=== TREE.JSON LOADED ===");
                console.log("File size:", e.target.result.length, "bytes");
                console.log("Top-level keys:", Object.keys(data));
                
                // Check what format we have
                let nodes = data.nodes || data;
                console.log("Node count:", Object.keys(nodes).length);
                
                // Sample a node to see structure
                const keys = Object.keys(nodes).filter(k => k !== 'root');
                if (keys.length > 0) {
                    const sampleNode = nodes[keys[0]];
                    console.log("Sample node ID:", keys[0]);
                    console.log("Sample node:", JSON.stringify(sampleNode, null, 2).substring(0, 500));
                }
                
                const success = POE2Data.loadFromJSON(data);
                
                if (success) {
                    this.state.hasRealData = true;
                    
                    // Refresh UI with loaded data
                    this.populateKeystones();
                    this.updateDataStatus();
                    
                    // Hide warning
                    document.getElementById('noDataWarning').classList.add('hidden');
                    
                    // Show success message with stats
                    const keystoneCount = Object.keys(POE2Data.keystones).length;
                    const notableCount = Object.keys(POE2Data.notables).length;
                    const smallCount = Object.keys(POE2Data.smallNodes).length;
                    const totalNodes = Object.keys(POE2Data.allNodes).length;
                    
                    const msg = `Loaded: ${keystoneCount} keystones, ${notableCount} notables, ${smallCount} small (${totalNodes} total)`;
                    this.showToast(msg);
                    
                    console.log("=== LOAD SUMMARY ===");
                    console.log(msg);
                    console.log("Keystones:", Object.values(POE2Data.keystones).map(k => k.name).join(', '));
                    console.log("Class starts:", POE2Data.classStartNodes);
                    console.log("Connections count:", Object.keys(POE2Data.connections).length);
                } else {
                    alert('Failed to parse tree data. Check browser console (F12) for details.');
                }
            } catch (err) {
                console.error('Failed to load data file:', err);
                alert('Failed to load data file: ' + err.message);
            }
        };
        reader.readAsText(file);
    },
    
    /**
     * Check URL parameters for shared builds
     */
    checkUrlParams: function() {
        const params = new URLSearchParams(window.location.search);
        const buildParam = params.get('build');
        
        if (buildParam) {
            const buildData = TreeOptimizer.loadFromUrl(buildParam);
            if (buildData) {
                // Apply loaded configuration
                if (buildData.class) {
                    document.getElementById('ascendancy').value = buildData.class;
                }
                this.showToast('Build loaded from URL');
            }
        }
    }
};

// Add CSS animation for toasts
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
`;
document.head.appendChild(style);
