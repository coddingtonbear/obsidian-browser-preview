import {
  FileSystemAdapter,
  FileView,
  MarkdownView,
  Plugin,
  TAbstractFile,
  TFile,
} from "obsidian";
import * as http from "http";
import * as fs from "fs";
import * as url from "url";
import open from "open";

export default class ObsidianPrint extends Plugin {
  host: string = "127.0.0.1";
  port: number = 8124;

  server: http.Server;

  async writeMarkdownPreviewResponse(response: http.ServerResponse) {
    const activeLeaf = this.app.workspace.activeLeaf;
    const view = activeLeaf.view as MarkdownView;
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const basePath = adapter.getBasePath();
    const cssPath = basePath + "/obsidian.css";
    let body = view.previewMode.containerEl.innerHTML;

    const pathReplacements = [
      `app://local/${encodeURIComponent(adapter.getBasePath())}%2F`,
    ];
    for (const replacement of pathReplacements) {
      body = body.replace(replacement, "");
    }

    response.writeHead(200, "OK", { "Content-type": "text/html" });
    response.write("<!DOCTYPE html><html><head><meta charset='utf-8' />");
    if (fs.existsSync(cssPath)) {
      response.write("<style type='text/css'>");
      response.write(fs.readFileSync(cssPath));
      response.write("</style>");
    }
    response.write("</head><body>");
    response.write(body);
    response.write("</body></html>");
    response.end();
    return;
  }

  async writeRawFileResponse(filename: string, response: http.ServerResponse) {
    const matchingFiles = this.getMatchingFileObjectsForRoute(filename);

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
    const data = await this.app.vault.readBinary(matchingFile);

    response.writeHead(200, "OK", {
      "Content-Type": "application/octet-stream",
    });
    response.write(Buffer.from(data));
    response.end();
  }

  getMatchingFileObjectsForRoute(filename: string): TAbstractFile[] {
    const root = this.app.vault.getRoot();
    return root.children.filter((fileData: TFile) => {
      return fileData.path == filename;
    });
  }

  async requestListener(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) {
    const parsedUrl = new url.URL(`http://127.0.0.1${request.url}`);
    const location = decodeURI(parsedUrl.pathname).slice(1);

    if (location == "") {
      this.writeMarkdownPreviewResponse(response);
    } else {
      this.writeRawFileResponse(location, response);
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

        open(`http://127.0.0.1:${this.port}/`);
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
