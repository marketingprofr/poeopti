# POE2 Passive Tree Optimizer

A web-based tool to find the optimal 128-point passive tree path for Path of Exile 2 builds.

## 🎮 [Live Demo](https://yourusername.github.io/poe2-tree-optimizer/)

## Features

- **Ascendancy Selection**: Choose from all POE2 ascendancy classes
- **Skill-Based Optimization**: Select your target damage skill and the optimizer prioritizes relevant nodes
- **Offense/Defense Split**: Adjust the balance between damage and survivability
- **Required Keystones**: Lock in up to 3 must-have keystones
- **Smart Scoring**: Nodes are scored based on:
  - Relevance to your chosen skill (matching tags)
  - Weapon type compatibility
  - Offense/defense contribution
  - Node efficiency (value per point)
- **Export Options**:
  - PoB-compatible code
  - JSON download
  - Shareable URL

## How It Works

### Algorithm

1. **Node Scoring**: Each passive node is scored based on:
   - Tag matching with your selected skill
   - Weighted offense/defense values
   - Node type multipliers (Keystone > Notable > Small)

2. **Greedy Allocation**: Nodes are allocated in order of score/efficiency

3. **Local Optimization**: Low-value nodes are swapped for better alternatives

### Data Sources

The tool can use tree data from:
- Path of Building POE2 (`tree.json`)
- POE2DB exports
- Official GGG exports (when available)

By default, the tool runs with sample data that demonstrates the algorithm. For accurate builds, import real tree data.

## Setup for GitHub Pages

1. Fork this repository
2. Go to Settings → Pages
3. Set source to "main" branch, root folder
4. Your optimizer will be live at `https://yourusername.github.io/poe2-tree-optimizer/`

## Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/poe2-tree-optimizer.git

# Open in browser (no build step required)
open index.html
```

## Loading Real Tree Data

1. Download tree.json from [POB-POE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2)
2. Click "Load Tree Data (JSON)" in the tool
3. Select the tree.json file

The data will be parsed and the optimizer will use real node values.

## Project Structure

```
poe2-tree-optimizer/
├── index.html          # Main page
├── css/
│   └── style.css       # Styling (POE2-themed dark mode)
├── js/
│   ├── data.js         # Tree data structure and sample nodes
│   ├── optimizer.js    # Optimization algorithm
│   └── app.js          # UI logic and event handling
├── data/               # (Optional) Pre-loaded tree data
└── README.md
```

## Contributing

Contributions are welcome! Areas that need work:

- [ ] Import actual POE2 tree data
- [ ] Add visual tree display
- [ ] Implement proper pathfinding (connectivity validation)
- [ ] Add ascendancy-specific node filtering
- [ ] Support for weapon specialization trees

## License

MIT License - Feel free to use and modify.

## Credits

- Tree data structure based on [Path of Building](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2)
- Game content belongs to Grinding Gear Games

## Disclaimer

This is a fan-made tool. Not affiliated with Grinding Gear Games.
