import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { workflowSpacesAPI } from '@/services/api';
import { toast } from 'sonner';
import ModelSelector from './ModelSelector';
import {
    Play,
    Loader2,
    Check,
    X,
    Copy,
    Download,
    AlertCircle,
    StopCircle,
} from 'lucide-react';

/**
 * WorkflowExecutionDialog Component
 *
 * Dialog for executing prompt sequences (DFG) in workflow spaces.
 * Features:
 * - Configuration: initial input, model selection, temperature, stop on error
 * - Execution progress: stepper showing current step
 * - Results display: accordion with each step's input/output
 * - Actions: copy, download results
 */
export function WorkflowExecutionDialog({
    workspaceId,
    workspaceName,
    prompts,
    isOpen,
    onClose,
    availableModels = { gemini: [], openrouter: [], custom: [] }, // Default value for safety
}) {
    const { t, i18n } = useTranslation();

    // Abort controller ref for stopping execution
    const abortControllerRef = useRef(null);

    // Execution configuration
    const [config, setConfig] = useState({
        initial_input: '',
        model: 'gemini-2.5-flash',
        temperature: 1.0,
        stop_on_error: true,
    });

    // Step selection state - track which steps are enabled (all enabled by default)
    const [enabledSteps, setEnabledSteps] = useState([]);

    // Execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [results, setResults] = useState([]);
    const [finalOutput, setFinalOutput] = useState('');
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('configure');

    // Initialize enabled steps when prompts change
    useEffect(() => {
        if (prompts && prompts.length > 0) {
            // All steps enabled by default
            setEnabledSteps(new Array(prompts.length).fill(true));
        }
    }, [prompts]);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            setResults([]);
            setFinalOutput('');
            setError(null);
            setCurrentStep(0);
            setActiveTab('configure');
            // Reset enabled steps to all true
            if (prompts && prompts.length > 0) {
                setEnabledSteps(new Array(prompts.length).fill(true));
            }
        }
    }, [isOpen, prompts]);

    // Handle workflow execution
    const handleExecute = async () => {
        if (!prompts || prompts.length === 0) {
            toast.error(t('No prompts in workflow'));
            return;
        }

        // Check if at least one step is enabled
        const hasEnabledSteps = enabledSteps.some(enabled => enabled);
        if (!hasEnabledSteps) {
            toast.error(t('Please enable at least one step to execute'));
            return;
        }

        // Create new AbortController for this execution
        abortControllerRef.current = new AbortController();

        setIsExecuting(true);
        setResults([]);
        setFinalOutput('');
        setError(null);
        setCurrentStep(0);
        setActiveTab('results');

        try {
            // Create config with enabled steps
            const executionConfig = {
                ...config,
                enabled_steps: enabledSteps, // Pass enabled steps to backend
            };

            // Use SSE streaming for real-time progress updates
            await workflowSpacesAPI.executeWorkflowStream(
                workspaceId,
                executionConfig,
                (eventData) => {
                    // Handle different event types
                    switch (eventData.event_type) {
                        case 'init':
                            // Workflow initialized
                            console.log('Workflow initialized:', eventData.workspace_name);
                            break;

                        case 'start':
                            // Step started - update current step
                            setCurrentStep(eventData.step - 1); // Convert to 0-based index
                            console.log(`Step ${eventData.step} started:`, eventData.prompt_title);
                            break;

                        case 'complete':
                            // Step completed successfully - add result
                            setResults(prev => [...prev, {
                                step: eventData.step,
                                prompt_id: eventData.prompt_id,
                                prompt_title: eventData.prompt_title,
                                input: eventData.input,
                                output: eventData.output,
                                execution_time: eventData.execution_time,
                                error: null
                            }]);
                            console.log(`Step ${eventData.step} completed`);
                            break;

                        case 'step_error':
                            // Step failed - add error result
                            setResults(prev => [...prev, {
                                step: eventData.step,
                                prompt_id: eventData.prompt_id,
                                prompt_title: eventData.prompt_title,
                                input: eventData.input || '(no input)',
                                output: null,
                                execution_time: eventData.execution_time,
                                error: eventData.error
                            }]);
                            console.error(`Step ${eventData.step} failed:`, eventData.error);
                            break;

                        case 'workflow_complete':
                            // Entire workflow completed
                            setFinalOutput(eventData.final_output || '');
                            setIsExecuting(false);

                            if (eventData.success) {
                                toast.success(
                                    t('Workflow completed: {{completed}}/{{total}} steps', {
                                        completed: eventData.completed_steps || 0,
                                        total: eventData.total_steps || prompts.length,
                                    })
                                );
                            } else {
                                toast.warning(
                                    t('Workflow completed with errors: {{completed}}/{{total}} steps', {
                                        completed: eventData.completed_steps || 0,
                                        total: eventData.total_steps || prompts.length,
                                    })
                                );
                            }
                            console.log('Workflow completed:', eventData);
                            break;

                        case 'aborted':
                            // Workflow was stopped by user
                            setIsExecuting(false);
                            toast.info(t('workflow_execution_stopped'));
                            console.log('Workflow execution stopped by user');
                            break;

                        case 'error':
                            // Fatal error occurred
                            setError(eventData.error || 'Unknown error');
                            setIsExecuting(false);
                            toast.error(t('Workflow error: {{error}}', { error: eventData.error }));
                            console.error('Workflow error:', eventData.error);
                            break;

                        default:
                            console.log('Unknown event type:', eventData.event_type, eventData);
                    }
                },
                i18n.language,
                abortControllerRef.current.signal // Pass abort signal
            );

        } catch (err) {
            console.error('Workflow execution error:', err);

            // Don't show error if it was aborted
            if (err.name === 'AbortError') {
                return;
            }

            const errorMessage = err.response?.data?.error || err.message || 'Failed to execute workflow';
            setError(errorMessage);
            setIsExecuting(false);
            toast.error(t('Execution error: {{error}}', { error: errorMessage }));
        } finally {
            // Cleanup abort controller
            abortControllerRef.current = null;
        }
    };

    // Stop workflow execution
    const handleStopExecution = () => {
        if (abortControllerRef.current) {
            console.log('Stopping workflow execution...');
            abortControllerRef.current.abort();
        }
    };

    // Copy text to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(t('Copied to clipboard'));
        }).catch((err) => {
            console.error('Failed to copy:', err);
            toast.error(t('Failed to copy'));
        });
    };

    // Toggle step enabled/disabled
    const toggleStep = (index) => {
        const newEnabledSteps = [...enabledSteps];
        newEnabledSteps[index] = !newEnabledSteps[index];
        setEnabledSteps(newEnabledSteps);
    };

    // Enable all steps
    const enableAllSteps = () => {
        setEnabledSteps(new Array(prompts.length).fill(true));
    };

    // Disable all steps
    const disableAllSteps = () => {
        setEnabledSteps(new Array(prompts.length).fill(false));
    };

    // Download results as JSON
    const downloadResults = () => {
        const data = {
            workspace_name: workspaceName,
            executed_at: new Date().toISOString(),
            configuration: config,
            results: results,
            final_output: finalOutput,
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-${workspaceName.replace(/\s+/g, '-')}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(t('Results downloaded'));
    };

    // Get step status for styling
    const getStepStatus = (index) => {
        const result = results[index];
        if (!result) return 'pending';
        if (result.error) return 'error';
        return 'success';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                        {t('Run Workflow')}: {workspaceName}
                    </DialogTitle>
                    <DialogDescription>
                        {prompts.length} {t('steps in sequence')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="w-full">
                        <TabsTrigger value="configure" className="flex-1">
                            {t('Configure')}
                        </TabsTrigger>
                        <TabsTrigger value="results" disabled={results.length === 0} className="flex-1">
                            {t('Results')}
                            {results.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {results.filter(r => !r.error).length}/{results.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="configure" className="flex-1 overflow-y-auto mt-4 space-y-6">
                        <div className="space-y-4">
                            {/* Step Selection */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium">
                                        {t('Select Steps to Execute')}
                                    </Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={enableAllSteps}
                                            className="h-7 text-xs"
                                        >
                                            {t('Enable All')}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={disableAllSteps}
                                            className="h-7 text-xs"
                                        >
                                            {t('Disable All')}
                                        </Button>
                                    </div>
                                </div>
                                <div className="border rounded-lg p-3 space-y-2 max-h-[300px] overflow-y-auto">
                                    {prompts.map((prompt, index) => (
                                        <div
                                            key={prompt.id || index}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                                        >
                                            <Checkbox
                                                id={`step-${index}`}
                                                checked={enabledSteps[index] || false}
                                                onCheckedChange={() => toggleStep(index)}
                                            />
                                            <Label
                                                htmlFor={`step-${index}`}
                                                className="flex-1 flex items-center gap-2 cursor-pointer"
                                            >
                                                <span className="text-xs font-medium text-muted-foreground w-6">
                                                    {index + 1}.
                                                </span>
                                                <span className="text-sm font-medium flex-1">
                                                    {prompt.title}
                                                </span>
                                                {prompt.category && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {prompt.category}
                                                    </Badge>
                                                )}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('{{count}} of {{total}} steps enabled', {
                                        count: enabledSteps.filter(Boolean).length,
                                        total: prompts.length,
                                    })}
                                </p>
                            </div>

                            {/* Initial Input */}
                            <div>
                                <Label htmlFor="initial-input" className="text-sm font-medium">
                                    {t('Initial Input')} <span className="text-muted-foreground">({t('optional')})</span>
                                </Label>
                                <Textarea
                                    id="initial-input"
                                    value={config.initial_input}
                                    onChange={(e) => setConfig({ ...config, initial_input: e.target.value })}
                                    placeholder={t('Enter initial input for the first prompt...')}
                                    rows={4}
                                    className="mt-1"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('This will be passed to the first prompt. Leave empty if the first prompt doesn\'t need input.')}
                                </p>
                            </div>

                            {/* Model and Temperature */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">{t('Model')}</Label>
                                    <div className="mt-1">
                                        <ModelSelector
                                            availableModels={availableModels}
                                            selectedModel={config.model}
                                            onModelChange={(model) => setConfig({ ...config, model })}
                                            disabled={false}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t('Select the AI model to use for all prompts')}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('Temperature')}: {config.temperature.toFixed(1)}
                                    </Label>
                                    <Slider
                                        value={[config.temperature]}
                                        onValueChange={([temp]) => setConfig({ ...config, temperature: temp })}
                                        min={0}
                                        max={2}
                                        step={0.1}
                                        className="mt-2"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t('Higher values make output more random, lower values more focused')}
                                    </p>
                                </div>
                            </div>

                            {/* Stop on Error */}
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="stop-on-error"
                                    checked={config.stop_on_error}
                                    onCheckedChange={(checked) => setConfig({ ...config, stop_on_error: checked })}
                                />
                                <Label
                                    htmlFor="stop-on-error"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {t('Stop execution on error')}
                                </Label>
                            </div>

                            {/* Execute/Stop Button */}
                            {isExecuting ? (
                                <Button
                                    onClick={handleStopExecution}
                                    variant="destructive"
                                    className="w-full mt-6"
                                    size="lg"
                                >
                                    <StopCircle className="mr-2 h-5 w-5" />
                                    {t('stop_workflow_execution')}
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleExecute}
                                    disabled={prompts.length === 0}
                                    className="w-full mt-6"
                                    size="lg"
                                >
                                    <Play className="mr-2 h-5 w-5" />
                                    {t('Execute Workflow')}
                                </Button>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="results" className="flex-1 overflow-y-auto mt-4 custom-scrollbar">
                        <div className="space-y-6">
                            {/* Progress Stepper */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold mb-3">{t('Progress')}</h3>
                                {prompts.map((prompt, index) => {
                                    const status = getStepStatus(index);
                                    const isCurrent = index === currentStep && isExecuting;

                                    return (
                                        <div key={prompt.id || index} className="flex items-center gap-3">
                                            {/* Status Icon */}
                                            <div
                                                className={`
                          w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
                          ${status === 'success' ? 'bg-green-500 text-white' : ''}
                          ${status === 'error' ? 'bg-red-500 text-white' : ''}
                          ${status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                          ${isCurrent ? 'animate-pulse bg-blue-500 text-white' : ''}
                        `}
                                            >
                                                {status === 'success' && <Check className="h-4 w-4" />}
                                                {status === 'error' && <X className="h-4 w-4" />}
                                                {status === 'pending' && !isCurrent && (
                                                    <span className="text-xs font-medium">{index + 1}</span>
                                                )}
                                                {isCurrent && <Loader2 className="h-4 w-4 animate-spin" />}
                                            </div>

                                            {/* Step Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{prompt.title}</p>
                                                {prompt.category && (
                                                    <p className="text-xs text-muted-foreground">{prompt.category}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {/* Results Accordion */}
                            {results.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-3">{t('Step Results')}</h3>
                                    <Accordion type="single" collapsible className="w-full">
                                        {results.map((result, index) => (
                                            <AccordionItem key={index} value={`step-${index}`}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center gap-2 text-left">
                                                        <span className="font-medium">
                                                            {t('Step {{number}}', { number: result.step })}:
                                                        </span>
                                                        <span className="truncate">{result.prompt_title}</span>
                                                        <Badge
                                                            variant={result.error ? 'destructive' : 'success'}
                                                            className="ml-auto"
                                                        >
                                                            {result.error ? t('Failed') : t('Success')}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-3 pt-2">
                                                        {/* Input */}
                                                        {result.input && result.input !== '(no input)' && (
                                                            <div>
                                                                <Label className="text-xs text-muted-foreground">
                                                                    {t('Input')}:
                                                                </Label>
                                                                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto mt-1 whitespace-pre-wrap break-words">
                                                                    {result.input}
                                                                </pre>
                                                            </div>
                                                        )}

                                                        {/* Output */}
                                                        {result.output && (
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <Label className="text-xs text-muted-foreground">
                                                                        {t('Output')}:
                                                                    </Label>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => copyToClipboard(result.output)}
                                                                        className="h-7"
                                                                    >
                                                                        <Copy className="h-3 w-3 mr-1" />
                                                                        {t('Copy')}
                                                                    </Button>
                                                                </div>
                                                                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap break-words">
                                                                    {result.output}
                                                                </pre>
                                                            </div>
                                                        )}

                                                        {/* Error */}
                                                        {result.error && (
                                                            <Alert variant="destructive">
                                                                <AlertCircle className="h-4 w-4" />
                                                                <AlertDescription className="text-xs">
                                                                    {result.error}
                                                                </AlertDescription>
                                                            </Alert>
                                                        )}

                                                        {/* Execution Time */}
                                                        <p className="text-xs text-muted-foreground">
                                                            {t('Execution time')}: {result.execution_time?.toFixed(2)}s
                                                        </p>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            )}

                            {/* Final Output */}
                            {finalOutput && (
                                <div className="border rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">{t('Final Output')}:</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => copyToClipboard(finalOutput)}
                                            >
                                                <Copy className="h-3 w-3 mr-1" />
                                                {t('Copy')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={downloadResults}
                                            >
                                                <Download className="h-3 w-3 mr-1" />
                                                {t('Download')}
                                            </Button>
                                        </div>
                                    </div>
                                    <ScrollArea className="max-h-[200px]">
                                        <pre className="bg-muted p-3 rounded-md text-xs whitespace-pre-wrap break-words">
                                            {finalOutput}
                                        </pre>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
