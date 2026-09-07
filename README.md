# Moon AI Notes

[简体中文](https://github.com/moonejue/siyuan-moon-ai/blob/main/README_zh_CN.md)

Moon AI Notes is a SiYuan writing assistant that can reference multiple notes, run customizable commands, and write AI-generated content back to a selected note.

![Moon AI Notes preview](https://raw.githubusercontent.com/moonejue/siyuan-moon-ai/main/preview.png)

## Features

- Type `@` in the prompt to search for and reference multiple SiYuan notes.
- Save multiple model profiles, each with its own provider, endpoint, model, API key, temperature, and system prompt.
- Use DeepSeek, OpenAI, Ollama, LM Studio, or another OpenAI-compatible endpoint.
- Copy a response, append it to the selected target note, or replace the target note after confirmation.
- Create and edit reusable quick commands.
- Select text in a note to open an AI toolbar for polishing, translating, summarizing, expanding, shortening, rewriting, continuing, or applying a mindful writing style.
- Compare selected text with the AI result before copying, editing, regenerating, replacing, or inserting it.

## Installation

Install **Moon AI Notes** from SiYuan's community marketplace.

For manual installation, download `package.zip` from the latest GitHub Release, extract it to `<workspace>/data/plugins/siyuan-moon-ai`, and restart SiYuan.

## Usage

1. Enable the plugin and click the moon icon in SiYuan's top bar, or press `Option + Command + M` on macOS.
2. Open **AI Settings**, choose or create a connection profile, enter the model and credentials, test the connection, then save the profile.
3. Type `@` in the prompt to reference notes, or click **Reference current note**. The note marked as the target receives append or replace operations.
4. Enter an instruction and send it, or run a quick command.
5. Copy the result, append it to the target, or replace the target after reviewing the confirmation.
6. To edit part of a note, select text inside one block and choose an action from the selection toolbar.

## Custom Providers

Choose the custom OpenAI-compatible provider and `OpenAI Compatible`. Enter the provider's exact model ID and API key (without the `Bearer ` prefix). Switching to custom preserves the current endpoint, model, and protocol. Use `Ollama Chat` for Ollama's native API.

A bare origin such as `https://api.example.com` expands to `/v1/chat/completions`. A path prefix such as `/compatible-mode/v1` or `/custom` receives only `/chat/completions`. Complete `/chat/completions` URLs and query parameters are preserved. Include `/v1` explicitly when required by your gateway. Test each profile, then save it; connection tests do not save changes automatically.

## Troubleshooting

- **Request body is empty on SiYuan v3.8.3:** upgrade to plugin **v1.4.3** and restart SiYuan. This version fixes the proxy request-body encoding.
- **HTTP 401 / 403:** check the API key and provider permissions.
- **HTTP 404:** check the endpoint path and model ID. Supported protocols are OpenAI Chat Completions and Ollama Chat.
- **Local connection errors:** start the model server first. Failed direct local requests fall back to the SiYuan backend; localhost inside Docker refers to the container.

## Local Models

- Ollama defaults to `http://127.0.0.1:11434`. Use a model name shown by `ollama list`.
- LM Studio defaults to `http://127.0.0.1:1234/v1`. Load a model and start the local server first.

## Privacy

- Connection profiles and API keys are stored only in the current SiYuan workspace's plugin data directory.
- When a remote provider is used, the current instruction and selected reference-note content are sent to that provider.
- Ollama and LM Studio can process requests locally.
- Replacing a note requires confirmation. SiYuan document history remains the recovery mechanism.
- The plugin is disabled in SiYuan publish mode to prevent AI configuration from being exposed in published content.

## Compatibility

- SiYuan `3.0.0` or later.
- Desktop, desktop browser, and desktop window frontends.
- macOS, Windows, Linux, and Docker backends.

## Changelog

### v1.4.3

- Fix empty proxy request bodies on SiYuan v3.8.3 by using JSON payload encoding.
- Preserve endpoint, model, and protocol when switching to a custom provider.
- Fix custom gateway paths, query parameters, full completion URLs, and IPv6 loopback detection.
- Avoid clearing profile fields when settings are read outside the settings view.
- Match the note interface with charcoal surfaces, muted lavender accents, subtle borders, and SiYuan theme colors across the dock and selection UI.
- Add regression coverage for proxy encoding, URL handling, and profile persistence. Existing writing features are retained.

### v1.4.2

- Compress the icon for marketplace limits and remove unsupported manifest metadata.

### v1.4.1

- Prepare marketplace resources and release validation.

### v1.4.0

- Added a selection AI toolbar with eight built-in editing actions and custom instructions.
- Added a side-by-side comparison dialog in the Moon Teacher visual style.
- Added regenerate, direct edit, copy, replace selection, and insert-after-selection actions.

## License

[MIT](https://github.com/moonejue/siyuan-moon-ai/blob/main/LICENSE)

## Support

If Moon AI Notes helps your writing, you can support its continued development through WeChat Pay.

<img src="https://raw.githubusercontent.com/moonejue/siyuan-moon-ai/main/assets/donate-wechat.jpg" alt="Moon Teacher WeChat Pay donation code" width="360">
