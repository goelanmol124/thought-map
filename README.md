# Thought Map

**Thought Map** is a hierarchical brainstorming and note-taking tool designed to help you organize your thoughts in a structured question-and-answer format. It allows you to break down complex topics into manageable pieces, ensuring no idea is lost.

## Features

- **Hierarchical Thinking**: Create a tree of knowledge by breaking down topics into questions and answers.
- **Inbox System**: Quickly capture unanswered questions in a dedicated inbox to process later, keeping your flow uninterrupted.
- **Markdown Export**: Export your entire thought map to a formatted Markdown file for easy sharing, documentation, or archiving.
- **Theme Support**: Includes a built-in Dark Mode and Light Mode to suit your preference.
- **Local Persistence**: All your maps are automatically saved locally using Yjs and IndexedDB, ensuring your data is safe and available when you return.

## Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State & Persistence**: [Yjs](https://github.com/yjs/yjs) & [y-indexeddb](https://github.com/yjs/y-indexeddb)

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm (comes with Node.js)

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd thought-map
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the App

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

### Building for Production

To create a production-ready build:

```bash
npm run build
```

The output will be in the `dist` directory.
