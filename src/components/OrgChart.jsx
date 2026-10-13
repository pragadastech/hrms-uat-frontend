
import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    MiniMap,
    Controls,
    Background,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Briefcase } from 'lucide-react';

// Custom Node Component
const CustomNode = ({ data }) => {
    return (
        <div style={{
            padding: '12px 20px',
            borderRadius: '8px',
            background: 'white',
            border: '1px solid #e2e8f0',
            minWidth: '220px',
            maxWidth: '250px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
            <Handle type="target" position={Position.Top} style={{ background: '#6366f1' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(data.label)}&background=random&size=48`}
                    alt="Profile"
                    style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{data.label}</div>
                    {data.role && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{data.role}</div>
                    )}
                    {data.department && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{data.department}</div>
                    )}
                    {data.position && data.position !== data.role && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{data.position}</div>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1' }} />
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

// Initial Mock Data (Fallback)
const initialNodes = [
    { id: '1', type: 'custom', position: { x: 250, y: 0 }, data: { label: 'Admin User', role: 'CEO' } },
    { id: '2', type: 'custom', position: { x: 100, y: 150 }, data: { label: 'John Doe', role: 'Engineering Manager' } },
    { id: '3', type: 'custom', position: { x: 400, y: 150 }, data: { label: 'Jane Smith', role: 'Product Manager' } },
];

const initialEdges = [
    { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#6366f1' } },
    { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: '#6366f1' } },
];

export default function OrgChart({ hierarchyData }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        if (hierarchyData) {
            const newNodes = [];
            const newEdges = [];
            const nodeMap = new Map(); // Map employee IDs to node IDs
            let nodeIdCounter = 1;

            // Check if it's org-wide hierarchy (for admins) or employee-specific hierarchy
            if (hierarchyData.type === 'org-wide' && hierarchyData.employees) {
                // Build full organization-wide hierarchy tree
                const employees = hierarchyData.employees;
                
                // Build a map of manager -> subordinates
                const managerToSubordinates = new Map();
                const allEmployeeIds = new Set();
                
                employees.forEach(emp => {
                    const empId = emp.id;
                    allEmployeeIds.add(empId);
                    
                    if (emp.reportingManagerId) {
                        if (!managerToSubordinates.has(emp.reportingManagerId)) {
                            managerToSubordinates.set(emp.reportingManagerId, []);
                        }
                        managerToSubordinates.get(emp.reportingManagerId).push(emp);
                    }
                });
                
                // Find root employees (those without managers)
                const rootEmployees = employees.filter(emp => !emp.reportingManagerId);
                
                // If no root employees found, find employees whose managers are not in the list
                const rootIds = rootEmployees.length > 0 
                    ? rootEmployees.map(e => e.id)
                    : employees.filter(emp => !allEmployeeIds.has(emp.reportingManagerId)).map(e => e.id);
                
                // Calculate subtree width recursively to prevent overlaps
                const calculateSubtreeWidth = (employeeId, level) => {
                    const subordinates = managerToSubordinates.get(employeeId) || [];
                    if (subordinates.length === 0) {
                        return 300; // Base width for a single node
                    }
                    
                    // Calculate total width needed for all subordinates
                    let totalWidth = 0;
                    subordinates.forEach(sub => {
                        totalWidth += calculateSubtreeWidth(sub.id, level + 1);
                    });
                    
                    // Add spacing between subtrees
                    const spacing = Math.max(50, subordinates.length * 50);
                    return Math.max(300, totalWidth + spacing);
                };
                
                // Build tree structure starting from roots with proper spacing
                const buildTree = (employeeId, level, xOffset, yOffset) => {
                    const employee = employees.find(e => e.id === employeeId);
                    if (!employee) return { x: xOffset, y: yOffset, width: 300, nodeId: null };

                    const nodeId = `node-${nodeIdCounter++}`;
                    const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId || 'Unknown';
                    const role = employee.position || employee.jobTitle || 'Employee';
                    const department = employee.department || employee.departmentName || null;

                    // Key by String to ensure consistent map lookups regardless of number/string coercion
                    nodeMap.set(String(employeeId), nodeId);
                    newNodes.push({
                        id: nodeId,
                        type: 'custom',
                        position: { x: xOffset, y: yOffset },
                        data: {
                            label: employeeName,
                            role: role,
                            department: department,
                            position: employee.position || employee.jobTitle || null
                        }
                    });

                    // Get subordinates
                    const subordinates = managerToSubordinates.get(employeeId) || [];
                    if (subordinates.length > 0) {
                        // Calculate spacing based on subtree widths
                        const subtreeWidths = subordinates.map(sub => calculateSubtreeWidth(sub.id, level + 1));
                        const totalSubtreeWidth = subtreeWidths.reduce((sum, w) => sum + w, 0);
                        const spacing = Math.max(80, (totalSubtreeWidth / subordinates.length) * 0.3);

                        // Start positioning from the left edge of the subtree
                        let currentX = xOffset - (totalSubtreeWidth / 2) + (subtreeWidths[0] / 2);
                        const nextY = yOffset + 200; // Increased vertical spacing

                        subordinates.forEach((sub, index) => {
                            const subtreeWidth = subtreeWidths[index];
                            const subX = currentX;
                            const subY = nextY;

                            // Recursively build subtree — capture returned nodeId directly
                            const { nodeId: childNodeId } = buildTree(sub.id, level + 1, subX, subY);

                            // Add edge from manager to subordinate using returned nodeId (never undefined)
                            if (childNodeId) {
                                newEdges.push({
                                    id: `e-${nodeId}-${childNodeId}`,
                                    source: nodeId,
                                    target: childNodeId,
                                    animated: true,
                                    style: { stroke: '#6366f1' }
                                });
                            }

                            // Move to next position
                            currentX += subtreeWidth + spacing;
                        });
                    }

                    return { x: xOffset, y: yOffset, width: calculateSubtreeWidth(employeeId, level), nodeId };
                };

                
                // Build trees for all root employees with proper spacing
                if (rootIds.length > 0) {
                    // Calculate widths for each root tree
                    const rootWidths = rootIds.map(rootId => calculateSubtreeWidth(rootId, 0));
                    const totalRootWidth = rootWidths.reduce((sum, w) => sum + w, 0);
                    const rootSpacing = Math.max(150, totalRootWidth / rootIds.length * 0.5);
                    
                    // Start from center and distribute roots
                    let currentRootX = 500 - (totalRootWidth / 2) + (rootWidths[0] / 2);
                    const startY = 50;
                    
                    rootIds.forEach((rootId, index) => {
                        const rootWidth = rootWidths[index];
                        const xPos = currentRootX;
                        const yPos = startY;
                        
                        buildTree(rootId, 0, xPos, yPos);
                        
                        // Move to next root position
                        currentRootX += rootWidth + rootSpacing;
                    });
                } else if (employees.length > 0) {
                    // If no clear roots, just show all employees in a grid structure with better spacing
                    const colsPerRow = 4;
                    const horizontalSpacing = 280; // Increased from 200
                    const verticalSpacing = 200; // Increased from 150
                    
                    employees.forEach((emp, index) => {
                        const nodeId = `node-${nodeIdCounter++}`;
                        const employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Unknown';
                        const role = emp.position || emp.jobTitle || 'Employee';
                        const department = emp.department || emp.departmentName || null;
                        
                        nodeMap.set(emp.id, nodeId);
                        const row = Math.floor(index / colsPerRow);
                        const col = index % colsPerRow;
                        const xPos = 100 + (col * horizontalSpacing);
                        const yPos = 50 + (row * verticalSpacing);
                        
                        newNodes.push({
                            id: nodeId,
                            type: 'custom',
                            position: { x: xPos, y: yPos },
                            data: { 
                                label: employeeName,
                                role: role,
                                department: department,
                                position: emp.position || emp.jobTitle || null
                            }
                        });
                        
                        // Add edge if has manager
                        if (emp.reportingManagerId && nodeMap.has(emp.reportingManagerId)) {
                            newEdges.push({
                                id: `e-${nodeMap.get(emp.reportingManagerId)}-${nodeId}`,
                                source: nodeMap.get(emp.reportingManagerId),
                                target: nodeId,
                                animated: true,
                                style: { stroke: '#6366f1' }
                            });
                        }
                    });
                }
                
            } else if (hierarchyData.type === 'employee') {
                // Employee-specific hierarchy (managers above + employee + subordinates below)
                let yPosition = 0;
                let employeeNodeId = null; // Store employee node ID for connecting subordinates

                // 1. Add managers (above the employee)
                if (hierarchyData.managers && Array.isArray(hierarchyData.managers)) {
                    hierarchyData.managers.reverse().forEach((manager, index) => {
                        const nodeId = `node-${nodeIdCounter++}`;
                        const employeeName = manager.employeeName || `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || manager.employeeId || 'Unknown';
                        const role = manager.position || manager.jobTitle || 'Manager';
                        const department = manager.department || manager.departmentName || null;
                        
                        nodeMap.set(manager.id || manager.employeeId, nodeId);
                        newNodes.push({
                            id: nodeId,
                            type: 'custom',
                            position: { x: 400, y: yPosition },
                            data: { 
                                label: employeeName,
                                role: role,
                                department: department,
                                position: manager.position || manager.jobTitle || null
                            }
                        });
                        
                        // Add edge from this manager to the one below (if exists)
                        if (index > 0) {
                            const prevNodeId = `node-${nodeIdCounter - 2}`;
                            newEdges.push({
                                id: `e-${prevNodeId}-${nodeId}`,
                                source: prevNodeId,
                                target: nodeId,
                                animated: true,
                                style: { stroke: '#6366f1' }
                            });
                        }
                        
                        yPosition += 150;
                    });
                }

                // 2. Add the current employee (center)
                if (hierarchyData.employee) {
                    const employee = hierarchyData.employee;
                    employeeNodeId = `node-${nodeIdCounter++}`;
                    const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId || 'Current Employee';
                    const role = employee.position?.title || employee.position || employee.jobTitle || employee.designation || 'Employee';
                    const department = employee.department?.name || employee.department || employee.departmentName || null;
                    
                    nodeMap.set(employee.id || employee._id || employee.employeeId, employeeNodeId);
                    newNodes.push({
                        id: employeeNodeId,
                        type: 'custom',
                        position: { x: 400, y: yPosition },
                        data: { 
                            label: employeeName,
                            role: role,
                            department: department,
                            position: employee.position?.title || employee.position || employee.jobTitle || null
                        }
                    });
                    
                    // Add edge from last manager to current employee
                    if (hierarchyData.managers && hierarchyData.managers.length > 0 && newNodes.length > 1) {
                        const lastManagerNodeId = newNodes[newNodes.length - 2].id;
                        newEdges.push({
                            id: `e-${lastManagerNodeId}-${employeeNodeId}`,
                            source: lastManagerNodeId,
                            target: employeeNodeId,
                            animated: true,
                            style: { stroke: '#6366f1' }
                        });
                    }
                    
                    yPosition += 150;
                }

                // 3. Add subordinates (below the employee) with better spacing
                if (hierarchyData.subordinates && Array.isArray(hierarchyData.subordinates) && hierarchyData.subordinates.length > 0) {
                    console.log("OrgChart: Adding", hierarchyData.subordinates.length, "subordinates");
                    const subordinatesPerRow = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(hierarchyData.subordinates.length))));
                    const horizontalSpacing = 280; // Increased from 200
                    const verticalSpacing = 200; // Increased from 150
                    const startX = 400 - ((subordinatesPerRow - 1) * horizontalSpacing) / 2;
                    
                    hierarchyData.subordinates.forEach((subordinate, index) => {
                        const nodeId = `node-${nodeIdCounter++}`;
                        const employeeName = subordinate.employeeName || `${subordinate.firstName || ''} ${subordinate.lastName || ''}`.trim() || subordinate.employeeId || 'Unknown';
                        const role = subordinate.position || subordinate.jobTitle || 'Employee';
                        const department = subordinate.department || subordinate.departmentName || null;
                        
                        const row = Math.floor(index / subordinatesPerRow);
                        const col = index % subordinatesPerRow;
                        const xPosition = startX + (col * horizontalSpacing);
                        const yPos = yPosition + (row * verticalSpacing);
                        
                        nodeMap.set(subordinate.id || subordinate.employeeId, nodeId);
                        newNodes.push({
                            id: nodeId,
                            type: 'custom',
                            position: { x: xPosition, y: yPos },
                            data: { 
                                label: employeeName,
                                role: role,
                                department: department,
                                position: subordinate.position || subordinate.jobTitle || null
                            }
                        });
                        
                        // Add edge from current employee to subordinate
                        if (employeeNodeId) {
                            newEdges.push({
                                id: `e-${employeeNodeId}-${nodeId}`,
                                source: employeeNodeId,
                                target: nodeId,
                                animated: true,
                                style: { stroke: '#6366f1' }
                            });
                        }
                    });
                } else {
                    console.log("OrgChart: No subordinates found or subordinates array is empty");
                }
            }

            // Only update if we have real data
            if (newNodes.length > 0) {
                setNodes(newNodes);
                setEdges(newEdges);
            } else {
                // Fallback to empty state message
                setNodes([{
                    id: 'empty',
                    type: 'custom',
                    position: { x: 400, y: 200 },
                    data: { 
                        label: 'No hierarchy data available',
                        role: 'Please check reporting relationships'
                    }
                }]);
                setEdges([]);
            }
        } else {
            // No hierarchy data, show empty state
            setNodes([{
                id: 'empty',
                type: 'custom',
                position: { x: 400, y: 200 },
                data: { 
                    label: 'No hierarchy data available',
                    role: 'Please check reporting relationships'
                }
            }]);
            setEdges([]);
        }
    }, [hierarchyData, setNodes, setEdges]);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    // Determine height based on hierarchy type
    const chartHeight = hierarchyData?.type === 'org-wide' ? '800px' : '500px';

    return (
        <div style={{ width: '100%', height: chartHeight, background: '#f8fafc', borderRadius: '12px', overflow: 'hidden' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={2}
                preventScrolling={false}
            >
                <Controls />
                <MiniMap />
                <Background variant="dots" gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}
