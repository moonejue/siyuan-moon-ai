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

Install **Moon AI Notes** from SiYuan's community marketplace after it is listed.

For manual installation, download `package.zip` from the latest GitHub Release, extract it to `<workspace>/data/plugins/siyuan-moon-ai`, and restart SiYuan.

## Usage

1. Enable the plugin and click the moon icon in SiYuan's top bar, or press `Option + Command + M` on macOS.
2. Open **AI Settings**, choose or create a connection profile, enter the model and credentials, then test the connection.
3. Type `@` in the prompt to reference notes, or click **Reference current note**. The note marked as the target receives append or replace operations.
4. Enter an instruction and send it, or run a quick command.
5. Copy the result, append it to the target, or replace the target after reviewing the confirmation.
6. To edit part of a note, select text inside one block and choose an action from the selection toolbar.

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

### v1.4.0

- Added a selection AI toolbar with eight built-in editing actions and custom instructions.
- Added a side-by-side comparison dialog in the Moon Teacher visual style.
- Added regenerate, direct edit, copy, replace selection, and insert-after-selection actions.

## License

[MIT](https://github.com/moonejue/siyuan-moon-ai/blob/main/LICENSE)

## Support

If Moon AI Notes helps your writing, you can support its continued development through WeChat Pay.

<img src="https://raw.githubusercontent.com/moonejue/siyuan-moon-ai/main/assets/donate-wechat.jpg" alt="Moon Teacher WeChat Pay donation code" width="360">
