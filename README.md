# Maze Solver

This is a Node.js command-line utility designed to automatically solve the [Maze Puzzle](https://maze.robanderson.dev/) created by Rob Anderson for the Opencast Software Software Delivery Community.

It connects to the maze's WebSocket API and uses a Depth-First Search (DFS) algorithm to explore the maze, map its layout, and find the exit.

## The Puzzle

The original puzzle presents a randomly generated maze where the player navigates through fictional job roles at fictional startup companies. The player can only see their current location and available directions. For more details on the puzzle itself, see [PUZZLE.md](./PUZZLE.md).

## Features

- Connects to the maze WebSocket API.
- Uses an Depth-First Search (DFS) to explore and map the maze.
- Finds the exit location.
- Reports the start/end locations, total moves, and time taken.

## Installation

1.  Clone this repository:
    ```bash
    git clone <repository-url>
    cd maze-solver
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## Usage

1.  Start a new game on the [Maze website](https://maze.robanderson.dev/) or use an existing game ID.
2.  Copy the 13-character Maze ID from the URL (e.g., `https://maze.robanderson.dev/maze/{MAZE_ID}`).
3.  Run the solver from your terminal, passing the Maze ID as a command-line argument:

    ```bash
    node maze-solver.js <MAZE_ID>
    ```

The script will connect to the WebSocket, solve the maze, and print the results, including the start and end locations, total moves, and the time taken.
