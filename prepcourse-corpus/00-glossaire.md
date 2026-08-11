# [COMMUN] Glossaire — Key terms du Prep Course CCDV-F

Source : Prep Course CCDV-F officiel (Anthropic Partner Academy). Termes clés des modules 2 à 5.
Usage NotebookLM : garder ce fichier TOUJOURS coché — c'est le vocabulaire transversal, utile quel que soit le topic révisé.

---

Key terms from module 3  
Claude Agent SDK  
A programmable interface that exposes the same agent loop Claude Code runs in the terminal. It allows developers to invoke the loop from code, set the permission mode and available tools, and run tasks without an interactive session. The samepermission model and deny rules that apply in the terminal apply in the SDK.  
CLAUDE.md  
A Markdown file placed at the root of a Claude Code project. Its contents are prepended to the context window at the start of every session. It holds the universal project constraints, conventions, and commands that should applyunconditionally across all sessions. Files that grow beyond roughly 200-300 linesrisk diluting critical rules through content weight.  
Hook  
A command bound to a lifecycle event in Claude Code's execution (PreToolUse, PostToolUse, UserPromptSubmit, Stop). Unlike instructions in CLAUDE.md, hooks run deterministically at the configured event regardless of what the model decides. A PreToolUse hook can exit with code 2 to block a tool call before it runs.  
MCP (Model Context Protocol)  
An open communication layer that allows an MCP client such as Claude Code to connect to an MCP server that exposes tools, resources, and prompts. The protocoldefines how the client discovers and calls the server's tools. Using MCP moves tool definition and maintenance out of individual application code and into a reusable server that any MCP client can attach to.  
MCP transport  
The communication channel between an MCP client and an MCP server. stdio runs the server as a local subprocess on the same machine as the client. HTTP connectsto a remotely hosted server over a network. The choice of transport determineswhere the server can run and who can connect to it.  
Permission mode  
A setting in Claude Code that controls how often the agent stops to requestconfirmation before executing tool calls. Modes range from default (prompts before nearly every action) to bypass modes (no prompts at all). Deny rulesoverride any mode; a deny rule at the enterprise settings level cannot be bypassedby any individual configuration.  
Plugin  
A versioned bundle of Claude Code components (skills, hooks, subagents, and MCP server configurations) distributed through a marketplace. Installing a plugin gives the recipient the same setup as the author in a single step. Enterprise administrators can deploy plugins organization-wide through managed settings.  
Rules instruction file  
A file that scopes guidance to a specific path or condition in Claude Code. UnlikeCLAUDE.md, which loads for every session unconditionally, a rules file activatesonly when Claude Code is working in the directory it supervises. Used to keeppath-specific guidance out of the main project memory file.  
Subagent  
A separate execution context launched by Claude Code to handle a delegated task. A subagent does not inherit the main conversation's context or accumulated files; itstarts clean, performs the task, and returns only a summary. Using subagents for exploratory or investigative work keeps the main session context from filling withcontent that will not be reused.  
   
Key terms from module 4  
Agentic search  
Letting the model issue its own queries, read the results, and refine across severalrounds instead of fetching a fixed set of context once. It handles multi-stepquestions and changing corpora at higher token and latency cost and avoids the staleness and infrastructure of a maintained index.  
Eval  
A set of input cases, expected behaviors, and grades that defines what a featuremust do before it ships. Running an eval produces a score on a holdout set, whichturns "done" from a judgment call into a number you can track as you change the prompt, tools, or model.  
Exponential backoff  
A retry strategy that waits a growing interval between attempts, up to a cap and a fixed number of tries, often with random jitter. It prevents immediate retries fromdeepening a rate limit, and it honors a retry-after value when the response providesone.  
Hook-based guardrail  
A check that runs at a fixed point in the Claude Code agent lifecycle, suchas PreToolUse before a tool call, and can block an action and log it. Unlike a prompt instruction, a hook is an enforced control that runs before the protectedaction, which is the distinction a regulated review cares about.  
Integration test  
A test that exercises the seam where two components hand off, such as retrievaloutput passed into a model call. It catches the silent failures that unit and functional tests miss, because each component can pass alone while the handoffbetween them is wrong.  
LLM-as-judge  
A grading method that uses a second model call with a rubric to score open-endedoutputs that no code rule can check. It returns a score with reasoning, and it is onlytrustworthy after you calibrate it against human-labeled cases and measureagreement.  
Orchestrator-worker pattern  
A multi-agent shape where a lead agent plans a task, spawns subagents that workin parallel each with its own context and compiles their results. It helps on broadtasks that split into independent parts, at roughly fifteen times the token cost of a single chat in Anthropic's reported case.  
Prompt injection  
An attack where instructions hidden inside content the agent fetches are treated as commands, because the model reads its whole context as one stream with no built-in boundary between trusted instructions and untrusted data. The defense is to treatfetched content as data and enforce the action boundary outside the prompt.  
Retriable versus terminal error  
The first distinction for any production failure. A retriable error, such as a ratelimit or overload, is likely to succeed on a later attempt and gets backoff. A terminal error, such as a bad request, will fail again identically and should fail fast instead of wasting the retry budget.  
   
Key terms from module 5  
Accelerator  
A working solution packaged so the next engagement configures it rather thanrebuilding it. Customer-specific parts are exposed as documented parameters, the assumptions are written down, and an eval is bundled to prove the asset still worksin a new context.  
Contribution readiness  
What a maintainer needs to verify a contribution: focused code, a runnableexample, a test that proves the behavior, a statement of environment assumptions, and confirmed rights to contribute the code.  
Deployment platform  
Where a Claude workload runs. The six are: the first-party Claude API, Claude Platform on AWS, Claude in Amazon Bedrock, Claude on Amazon Bedrock(legacy), Google Vertex AI, and third-party platforms. The same model can differby platform on identity, data residency, latency, and cost.  
Model alias versus pinned ID  
An alias such as opus or sonnet resolves to a recommended version that updates over time and can differ by platform. A pinned full model ID is a fixed snapshot. Pinning is what keeps an upstream model change from being a silent production change.  
Trust boundary  
The seam where data or instructions move from one deployment environment to another in a multi-component app. Content fetched by one component is untrustedwhen it reaches the next, so the receiving component treats it as data, not instructions.