{pkgs}: {
  deps = [
    pkgs.openssh
    pkgs.sqlite
    pkgs.nodejs_22
    pkgs.bun
    pkgs.lsof
  ];
}
