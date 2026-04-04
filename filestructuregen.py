import json

def parse_tree(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        lines = [line.rstrip() for line in f if line.strip()]

    root = {"name": lines[0].strip("."), "type": "directory", "children": []}
    stack = [(root, -1)]  # (node, depth)

    for line in lines[1:]:
        # Determine depth by counting │ and ├── or └──
        stripped = line.lstrip("│ ")
        depth = (len(line) - len(stripped)) // 4
        name = stripped.replace("├── ", "").replace("└── ", "").strip()

        node = {"name": name, "type": "directory" if "." not in name else "file", "children": []}

        # Find parent based on depth
        while stack and stack[-1][1] >= depth:
            stack.pop()

        parent_node = stack[-1][0]
        if parent_node["type"] == "file":
            parent_node["type"] = "directory"  # in case it was misclassified
            parent_node["children"] = []

        parent_node["children"].append(node)
        stack.append((node, depth))

    return root

# Usage
tree_file = "filestructure.md"  # path to your uploaded tree text
tree_json = parse_tree(tree_file)

# Save as JSON
with open("project_structure.json", "w", encoding="utf-8") as f:
    json.dump(tree_json, f, indent=2)

print("JSON structure saved to project_structure.json")