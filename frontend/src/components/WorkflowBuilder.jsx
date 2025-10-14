import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { workflowAPI } from '../services/api';
import { 
  GitBranch, 
  Plus, 
  Play,
  Save,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const WorkflowBuilder = ({ workspaceId, workflowId, onBack }) => {
  const { t, i18n } = useTranslation();
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [executionInput, setExecutionInput] = useState('');

  useEffect(() => {
    if (workflowId) {
      loadWorkflow();
    }
  }, [workflowId]);

  const loadWorkflow = async () => {
    setLoading(true);
    try {
      const response = await workflowAPI.getWorkflow(workflowId, i18n.language);
      setWorkflow(response.data);
      setNodes(response.data.nodes || []);
      setEdges(response.data.edges || []);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast.error(t('failed_to_load_workflow') || 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      const updateData = {
        nodes: nodes.map(node => ({
          id: node.id,
          prompt_id: node.prompt_id,
          node_type: node.node_type,
          label: node.label,
          config: node.config,
          position_x: node.position_x,
          position_y: node.position_y
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source_node_id: edge.source_node_id,
          target_node_id: edge.target_node_id,
          label: edge.label,
          config: edge.config
        }))
      };
      
      await workflowAPI.updateWorkflow(workflowId, updateData, i18n.language);
      toast.success(t('workflow_saved') || 'Workflow saved successfully');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error(t('failed_to_save_workflow') || 'Failed to save workflow');
    }
  };

  const handleExecuteWorkflow = async () => {
    try {
      const inputData = executionInput ? JSON.parse(executionInput) : {};
      await workflowAPI.executeWorkflow(workflowId, { input_data: inputData }, i18n.language);
      toast.success(t('workflow_execution_started') || 'Workflow execution started');
      setShowExecuteDialog(false);
      setExecutionInput('');
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      toast.error(t('failed_to_execute_workflow') || 'Failed to execute workflow');
    }
  };

  const addNode = () => {
    const newNode = {
      id: Date.now(),
      workflow_id: workflowId,
      node_type: 'prompt',
      label: `Node ${nodes.length + 1}`,
      config: {},
      position_x: 100 + (nodes.length * 50),
      position_y: 100 + (nodes.length * 50)
    };
    setNodes([...nodes, newNode]);
  };

  if (loading) {
    return (
      <div className="h-full flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <GitBranch className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-700">
              {workflow?.name || t('workflow_builder') || 'Workflow Builder'}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveWorkflow}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {t('save') || 'Save'}
            </Button>
            <Button
              onClick={() => setShowExecuteDialog(true)}
              size="sm"
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {t('execute') || 'Execute'}
            </Button>
          </div>
        </div>
        {workflow?.description && (
          <p className="text-sm text-gray-600 mt-2">{workflow.description}</p>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-4">
        <div className="border rounded-lg bg-gray-50 min-h-full p-4">
          <div className="mb-4">
            <Button onClick={addNode} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('add_node') || 'Add Node'}
            </Button>
          </div>

          {/* Simple node visualization */}
          <div className="space-y-4">
            {nodes.map((node, index) => (
              <div key={node.id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">
                      {node.label || `Node ${index + 1}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Type: {node.node_type}
                    </div>
                  </div>
                  <button
                    onClick={() => setNodes(nodes.filter(n => n.id !== node.id))}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
                
                {index < nodes.length - 1 && (
                  <div className="mt-2 flex items-center text-gray-400">
                    <div className="h-px flex-1 bg-gray-300"></div>
                    <div className="px-2">↓</div>
                    <div className="h-px flex-1 bg-gray-300"></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {nodes.length === 0 && (
            <div className="text-center py-12">
              <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {t('no_nodes') || 'No nodes in this workflow yet'}
              </p>
              <p className="text-sm text-gray-400">
                {t('add_nodes_to_build_workflow') || 'Add nodes to build your workflow'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Execute Dialog */}
      <Dialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('execute_workflow') || 'Execute Workflow'}</DialogTitle>
            <DialogDescription>
              {t('execute_workflow_description') || 'Provide input data for the workflow execution (JSON format)'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              {t('input_data') || 'Input Data'}
            </label>
            <textarea
              value={executionInput}
              onChange={(e) => setExecutionInput(e.target.value)}
              placeholder='{"key": "value"}'
              className="w-full border rounded p-2 font-mono text-sm"
              rows={6}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExecuteDialog(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleExecuteWorkflow}>
              <Play className="h-4 w-4 mr-2" />
              {t('execute') || 'Execute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowBuilder;
