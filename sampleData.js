// Default clean template for internal IT projects (Zero Mock Data)

const DEFAULT_CLEAN_PROJECTS = [
  {
    id: "proj_001",
    name: "New IT Project",
    category: "General IT",
    leadName: "IT Lead",
    startDate: new Date().toISOString().split('T')[0],
    description: "Internal IT project scope and deliverables.",
    tasks: [
      { id: 1, name: "Core Implementation Phase", duration: 5, isSummary: true, level: 0, expanded: true, predecessors: "", resources: "IT Lead", progress: 0 },
      { id: 2, name: "Requirements & System Setup", duration: 2, isSummary: false, level: 1, predecessors: "", resources: "IT Engineer", progress: 0 },
      { id: 3, name: "Testing & Deployment", duration: 3, isSummary: false, level: 1, predecessors: "2", resources: "QA / Admin", progress: 0 }
    ]
  }
];
