// tools/ai.js
(function initAITool() {
    const aiCopilotBtn = document.getElementById('ai-copilot-btn');
    const aiCopilotWindow = document.getElementById('ai-copilot-window');
    const aiCloseBtn = document.getElementById('ai-close-btn');

    const aiInput = document.getElementById('ai-input');
    const aiSendBtn = document.getElementById('ai-send-btn');
    const chatHistory = document.getElementById('ai-chat-history');
    const providerSelect = document.getElementById('ai-provider-select');
    if (!aiInput || !aiSendBtn || !chatHistory || !providerSelect) return;

    if (aiCopilotBtn && aiCopilotWindow) {
        aiCopilotBtn.addEventListener('click', () => {
            aiCopilotWindow.classList.toggle('hidden');
            if (!aiCopilotWindow.classList.contains('hidden')) {
                aiInput.focus();
            }
        });
    }

    if (aiCloseBtn && aiCopilotWindow) {
        aiCloseBtn.addEventListener('click', () => {
            aiCopilotWindow.classList.add('hidden');
        });
    }

    // AI Provider Configurations (API keys moved to server proxy)
    const AI_PROVIDERS = {
        zhipu: { model: "glm-4.7-flash" },
        nvidia_llama_70b: { model: "meta/llama-3.1-70b-instruct" },
        nvidia_llama_8b: { model: "meta/llama-3.1-8b-instruct" },
        nvidia_nemotron: { model: "nvidia/nemotron-4-340b-instruct" },
        nvidia_mixtral: { model: "mistralai/mixtral-8x22b-instruct-v0.1" },
        nvidia_glm: { model: "z-ai/glm4.7" },
        nvidia_minimax: { model: "minimaxai/minimax-m2.5" }
    };

    // Application context for the AI
    const systemPrompt = `You are a helpful and highly capable AI Manager for a Web Toolbox application.
The user's app contains several tools:
- todo: A To-Do List manager
- pomodoro: A 25-minute Pomodoro focus timer
- notes: A Quick Notes scratchpad
- password: A random Password Generator
- habit: A 30-day Habit Tracker
- color: A Color Converter (HEX/RGB/HSL)
- decision: A Random Picker/Decision Maker

You have access to functions that can interact with the app.
When a user asks you to perform an action (e.g., "Add buy milk to my todo", "Turn on dark mode", "Switch to pomodoro"), you MUST output the corresponding function call. Do not just explain how to do it. ACTUALLY CALL THE FUNCTION.
If the user is just chatting or asking a general question, answer naturally. Be concise and friendly.
`;

    let messages = [
        { role: "system", content: systemPrompt }
    ];

    // Define the JSON schema for tools the AI can call
    const toolsDef = [
        {
            type: "function",
            function: {
                name: "switch_tool",
                description: "Switch the application view to a specific tool.",
                parameters: {
                    type: "object",
                    properties: {
                        tool_id: {
                            type: "string",
                            enum: ["todo", "pomodoro", "notes", "password", "habit", "color", "decision"],
                            description: "The ID of the tool to switch to."
                        }
                    },
                    required: ["tool_id"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "toggle_theme",
                description: "Toggle the application's visual theme between light mode and dark mode."
            }
        },
        {
            type: "function",
            function: {
                name: "add_todo",
                description: "Add a new task to the user's To-Do List.",
                parameters: {
                    type: "object",
                    properties: {
                        task: {
                            type: "string",
                            description: "The text description of the task."
                        }
                    },
                    required: ["task"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "append_note",
                description: "Append some text to the user's Quick Notes scratchpad.",
                parameters: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "The content to append to the notes."
                        }
                    },
                    required: ["text"]
                }
            }
        }
    ];

    // Execution maps for the AI's function calls
    const functionExecutors = {
        switch_tool: (args) => {
            // Find the sidebar button and mock a click
            const btn = document.querySelector(`.nav-btn[data-target="${args.tool_id}"]`);
            if (btn) {
                btn.click();
                return `Successfully switched to the ${args.tool_id} tool.`;
            }
            return `Failed to find tool: ${args.tool_id}`;
        },
        toggle_theme: () => {
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.click();
                return "Successfully toggled the theme.";
            }
            return "Failed to find theme toggle.";
        },
        add_todo: (args) => {
            // We can interact with localStorage directly to inject the task since tools are loosely coupled
            let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            tasks.push({
                id: Date.now().toString(),
                text: args.task,
                completed: false,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('tasks', JSON.stringify(tasks));

            // If the todo script is already loaded and active, we need to refresh it.
            // A simple hack is to re-render if the container is visible.
            if (window.renderTodoToolIfAvailable) {
                window.renderTodoToolIfAvailable();
            } else {
                // Trigger a custom event that the todo.js can listen for
                document.dispatchEvent(new CustomEvent('todo-updated'));
            }

            return `Successfully added "${args.task}" to the To-Do list.`;
        },
        append_note: (args) => {
            const { text } = args;
            // First check if the UI is currently open and has an active note selected
            const activeInput = document.getElementById('quick-notes-input');
            const activeTitle = document.getElementById('quick-notes-title');

            // We'll read the existing v2 notes array
            let notes = [];
            const savedData = localStorage.getItem('quick-notes-v2');
            if (savedData) {
                notes = JSON.parse(savedData);
            }

            if (notes.length === 0) {
                // If there are no notes at all, create an AI generated note
                notes.push({
                    id: Date.now().toString(),
                    title: "AI Generated Note",
                    content: text,
                    updatedAt: Date.now()
                });
            } else {
                // Determine which note to append to. Ideally the active one in UI if visible,
                // otherwise just append to the most recently updated one (index 0 if sorted properly).
                // Let's just append to the first note in the array for simplicity if UI isn't synced
                let targetNote = notes[0];
                targetNote.content = targetNote.content ? targetNote.content + "\n" + text : text;
                targetNote.updatedAt = Date.now();

                // Re-sort notes by latest
                notes.sort((a, b) => b.updatedAt - a.updatedAt);
            }

            // Save back to JSON array
            localStorage.setItem('quick-notes-v2', JSON.stringify(notes));

            // If the user happens to casually be looking at the Notes view right now, 
            // trigger an input event to force the UI script to re-render or at least sync up visually
            if (activeInput && !activeInput.disabled) {
                // Only update visually if we appended to the active note being viewed
                // The notes.js logic will auto-save everything else
                activeInput.value = activeInput.value ? activeInput.value + "\n" + text : text;
                // Dispatch event to trigger the auto-save binding which updates the UI list order 
                activeInput.dispatchEvent(new Event('input'));
            }

            return `Successfully appended to the most recent quick note.`;
        }
    };

    function appendMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role === 'user' ? 'user-msg' : 'assistant-msg'}`;

        let avatarIcon = role === 'user' ? 'fa-user' : 'fa-robot';

        msgDiv.innerHTML = `
            <div class="msg-avatar"><i class="fas ${avatarIcon}"></i></div>
            <div class="msg-bubble">${escapeHTML(content)}</div>
        `;

        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function appendLoading() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message assistant-msg loading-indicator';
        msgDiv.innerHTML = `
            <div class="msg-avatar"><i class="fas fa-robot"></i></div>
            <div class="msg-bubble msg-loading">
                <span></span><span></span><span></span>
            </div>
        `;
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return msgDiv;
    }

    async function sendToProvider() {
        const providerId = providerSelect.value;
        const config = AI_PROVIDERS[providerId];

        if (!config) {
            throw new Error(`Unknown provider: ${providerId}`);
        }

        const requestBody = {
            model: config.model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024
        };

        // Note: Different providers might have slightly different requirements for tool calling
        // NVIDIA supports it, but might not handle 'auto' the exact same way. 
        // We include it standard for OpenAI compatibilty.
        requestBody.tools = toolsDef;
        requestBody.tool_choice = "auto";

        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Authorization boundary moved to server.js
            },
            body: JSON.stringify({
                providerId: providerId,
                requestBody: requestBody
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Local Proxy Error [${providerId}]: ${response.status} ${response.statusText} - ${errBody}`);
        }

        return await response.json();
    }

    async function handleSubmission() {
        const text = aiInput.value.trim();
        if (!text) return;

        // UI Reset
        aiInput.value = '';
        aiSendBtn.disabled = true;
        appendMessage('user', text);
        messages.push({ role: 'user', content: text });

        const loader = appendLoading();

        try {
            let llmResponse = await sendToProvider();
            let assistantMessage = llmResponse.choices[0].message;

            // Handle Function Calling
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                messages.push(assistantMessage); // push the assistant's request to call a tool

                // Execute all tool calls
                for (let toolCall of assistantMessage.tool_calls) {
                    const funcName = toolCall.function.name;
                    const funcArgs = JSON.parse(toolCall.function.arguments);
                    console.log(`[AI Triggering Action]: ${funcName}`, funcArgs);

                    let functionResult = "Error: Function not implemented yet.";

                    if (functionExecutors[funcName]) {
                        try {
                            functionResult = functionExecutors[funcName](funcArgs);
                        } catch (e) {
                            functionResult = `Execution error: ${e.message}`;
                        }
                    }

                    // Push the tool result back into messages context
                    messages.push({
                        role: "tool",
                        content: functionResult,
                        tool_call_id: toolCall.id
                    });
                }

                // Send the tool results back to the LLM to get a final conversational response
                llmResponse = await sendToProvider();
                assistantMessage = llmResponse.choices[0].message;
            }

            // Remove Loader and append final reply
            loader.remove();

            if (assistantMessage.content) {
                appendMessage('assistant', assistantMessage.content);
                messages.push({ role: 'assistant', content: assistantMessage.content });
            } else {
                appendMessage('assistant', "Done! I've executed your command.");
            }

        } catch (error) {
            loader.remove();
            console.error(error);
            appendMessage('assistant', `Failed to connect to LLM: ${error.message}`);
        } finally {
            aiSendBtn.disabled = false;
            aiInput.focus();
        }
    }

    aiSendBtn.addEventListener('click', handleSubmission);

    aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmission();
        }
    });

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
})();
