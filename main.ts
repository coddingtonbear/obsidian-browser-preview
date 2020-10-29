import { MarkdownView, Notice, Plugin } from "obsidian";
import * as fs from "fs";
import tempfile from "tempfile";
import open from "open";

export default class ObsidianPrint extends Plugin {
  async onload() {
    this.addCommand({
      id: "open-preview-in-browser",
      name: "Open preview in browser",
      callback: async () => {
        const activeLeaf = this.app.workspace.activeLeaf;
        const view = activeLeaf.view as MarkdownView;
        const tempPath = tempfile(".html");

        fs.writeFile(
          tempPath,
          "<html><head></head><body>" +
            view.previewMode.containerEl.innerHTML +
            "</body></html>",
          (err) => {
            if (err) {
              throw new Notice(
                `Error writing temporary file to ${tempPath}: ${err}`
              );
            }

            open(tempPath);
          }
        );
      },
    });
  }
}
