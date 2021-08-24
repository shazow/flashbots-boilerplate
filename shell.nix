with import <nixpkgs> {};
pkgs.mkShell {
  buildInputs = [
    deno
    nodePackages.typescript-language-server # typescript/javascript language server
  ];
}
