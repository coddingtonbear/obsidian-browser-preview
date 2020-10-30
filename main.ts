import {
  FileSystemAdapter,
  FileView,
  MarkdownView,
  Plugin,
  TFile,
} from "obsidian";
import * as http from "http";
import open from "open";

export default class ObsidianPrint extends Plugin {
  host: string = "127.0.0.1";
  port: number = 8124;

  server: http.Server;

  async requestListener(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) {
    const location = decodeURI(request.url.slice(1));
    const activeLeaf = this.app.workspace.activeLeaf;
    const view = activeLeaf.view as MarkdownView;
    const adapter = this.app.vault.adapter as FileSystemAdapter;

    const root = this.app.vault.getRoot();

    const matchingFiles = root.children.filter((fileData: TFile) => {
      return (
        fileData.path == location ||
        (fileData.basename == location && fileData.extension == "md")
      );
    });

    if (matchingFiles.length == 0) {
      response.writeHead(404, "Not Found");
      response.write("Not found");
      response.end();
      return;
    } else if (matchingFiles.length > 1) {
      response.writeHead(404, "Multiple Matches");
      response.write("Multiple files sharing that name found.");
      response.end();
      return;
    }
    const matchingFile = matchingFiles[0] as TFile;

    if (matchingFile.extension == "md") {
      let body = view.previewMode.containerEl.innerHTML;

      const pathReplacements = [
        `app://local/${encodeURIComponent(adapter.getBasePath())}/`,
      ];
      for (const replacement in pathReplacements) {
        body = body.replace(replacement, "/");
      }

      response.writeHead(200, "OK", { "Content-type": "text/html" });
      response.write("<html><head><style type='text/css'>");
      response.write("</style></head><body>");
      response.write(body);
      response.write("</body></html>");
      response.end();
    } else {
      const data = await this.app.vault.readBinary(matchingFile);

      response.writeHead(200, "OK", {
        "Content-Type": "application/octet-stream",
      });
      response.write(Buffer.from(data));
      response.end();
    }
  }

  async onload() {
    this.server = http.createServer(this.requestListener.bind(this));
    this.server.listen(this.port, this.host);

    this.addCommand({
      id: "open-preview-in-browser",
      name: "Open preview in browser",
      callback: async () => {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeView = activeLeaf.view as FileView;
        const filename = activeView.file.path;

        open(`http://127.0.0.1:${this.port}/${filename}`);
      },
    });
    this.addCommand({
      id: "open-preview-debug",
      name: "Open preview debug",
      callback: async () => {
        console.log(this);
      },
    });
  }

  async onunload() {
    this.server.close();
  }
}
