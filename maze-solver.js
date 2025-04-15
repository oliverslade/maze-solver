const WebSocket = require("ws");

class MazeSolver {
  constructor(mazeId) {
    this.mazeId = mazeId;
    this.wsUrl = `wss://maze.robanderson.dev/ws/${mazeId}`;
    this.graph = new Map(); // locationId -> { availableDirections: [], neighbours: Map<direction, id>, data }
    this.currentId = null;
    this.startId = null;
    this.endId = null;
    this.moves = 0;
    this.resets = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on("open", () => resolve(true));
      this.ws.on("error", (error) => reject(error));
      this.ws.on("message", (data) => {
        const message = JSON.parse(data);
        if (this.messageCallback) {
          this.messageCallback(message);
        }
      });
    });
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      this.messageCallback = (message) => {
        this.messageCallback = null;
        resolve(message);
      };
      this.ws.send(JSON.stringify(command), (err) => {
        if (err) reject(err);
      });
    });
  }

  async move(direction) {
    const response = await this.sendCommand({ command: `go ${direction}` });
    this.moves++;
    this.currentId = response.id;
    return response;
  }

  findShortestPath(fromId, toId) {
    const queue = [[fromId]];
    const visited = new Set([fromId]);
    while (queue.length > 0) {
      const path = queue.shift();
      const last = path[path.length - 1];
      if (last === toId) return path;
      const node = this.graph.get(last);
      if (!node) continue;
      for (const [dir, neighbourId] of node.neighbours.entries()) {
        if (!visited.has(neighbourId)) {
          visited.add(neighbourId);
          queue.push([...path, neighbourId]);
        }
      }
    }
    return null;
  }

  getDirectionsForPath(path) {
    const dirs = [];
    for (let i = 0; i < path.length - 1; i++) {
      const node = this.graph.get(path[i]);
      for (const [dir, neighbourId] of node.neighbours.entries()) {
        if (neighbourId === path[i + 1]) {
          dirs.push(dir);
          break;
        }
      }
    }
    return dirs;
  }

  async solveOptimised() {
    await this.connect();
    const initialResponse = await new Promise((resolve) => {
      this.messageCallback = (message) => {
        this.messageCallback = null;
        resolve(message);
      };
    });
    this.startId = initialResponse.id;
    this.currentId = initialResponse.id;
    this.graph.set(this.startId, {
      availableDirections: initialResponse.availableDirections.slice(),
      neighbours: new Map(),
      data: initialResponse,
    });

    const visited = new Set([this.startId]);
    this.endId = null;

    // Stack for iterative DFS: stores { id, parentId, entryDir }
    // parentId and entryDir help with backtracking
    const stack = [{ id: this.startId, parentId: null, entryDir: null }];

    const reverseDir = (dir) =>
      ({ up: "down", down: "up", left: "right", right: "left" }[dir]);

    while (stack.length > 0) {
      const currentNodeInfo = stack[stack.length - 1]; // Peek
      const currentId = currentNodeInfo.id;

      if (currentId !== this.currentId) {
        console.warn(
          `State mismatch: currentId=${this.currentId}, stack top=${currentId}. Attempting recovery.`
        );
        const recoveryPath = this.findShortestPath(this.currentId, currentId);
        if (!recoveryPath)
          throw new Error(
            "DFS state mismatch and cannot find path to recover."
          );
        const recoveryDirs = this.getDirectionsForPath(recoveryPath);
        for (const dir of recoveryDirs) {
          await this.move(dir);
        }
      }

      const node = this.graph.get(currentId);
      const locationData = node.data;

      if (locationData.availableDirections.length === 0) {
        this.endId = currentId;
        break;
      }

      // Find the next unexplored direction
      let unexploredDir = null;
      for (const direction of locationData.availableDirections) {
        if (!node.neighbours.has(direction)) {
          unexploredDir = direction;
          break;
        }
      }

      if (unexploredDir) {
        const nextLoc = await this.move(unexploredDir);
        const nextId = nextLoc.id;
        const backDir = reverseDir(unexploredDir);

        node.neighbours.set(unexploredDir, nextId);

        if (!this.graph.has(nextId)) {
          this.graph.set(nextId, {
            availableDirections: nextLoc.availableDirections.slice(),
            neighbours: new Map([[backDir, currentId]]),
            data: nextLoc,
          });
          visited.add(nextId);
          stack.push({
            id: nextId,
            parentId: currentId,
            entryDir: unexploredDir,
          });
        } else {
          this.graph.get(nextId).neighbours.set(backDir, currentId);
          await this.move(backDir);
        }
      } else {
        const backtrackNodeInfo = stack.pop();

        if (stack.length > 0) {
          const parentId = backtrackNodeInfo.parentId;
          const dirToParent = reverseDir(backtrackNodeInfo.entryDir);
          if (!dirToParent) {
            throw new Error(
              `Cannot determine backtrack direction from ${backtrackNodeInfo.id} to ${parentId}`
            );
          }
          await this.move(dirToParent);
        }
      }
    }

    if (this.endId) {
      const endLocation = this.graph.get(this.endId).data;
      console.log("\n=== Maze Solved (Optimised DFS)! ===");
      console.log(
        `Start: ${this.graph.get(this.startId).data.name} - ${
          this.graph.get(this.startId).data.title
        }`
      );
      console.log(`End: ${endLocation.name} - ${endLocation.title}`);
      console.log(`Total moves: ${this.moves}`);
      console.log(`Total resets (time penalty): ${this.resets}`);
      console.log(`Total locations discovered: ${this.graph.size}`);
      console.log(
        "Note: This run is optimised for total time (minimising resets and unnecessary moves)."
      );
      this.ws.close();
      return true;
    } else {
      console.log(
        "Failed to find the end of the maze after exploring all reachable locations."
      );
      this.ws.close();
      return null;
    }
  }
}

if (require.main === module) {
  const mazeId = process.argv[2];
  if (!mazeId) process.exit(1);
  const solver = new MazeSolver(mazeId);
  console.log(`Solving maze ${mazeId}`);
  const startTime = Date.now();
  solver
    .solveOptimised()
    .then(() => {
      const duration = (Date.now() - startTime) / 1000;
      console.log(
        `\nMaze exploration completed in ${duration.toFixed(2)} seconds`
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error solving maze:", error);
      process.exit(1);
    });
}

module.exports = MazeSolver;
