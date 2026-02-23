# Analyzer

- It looks the analyzer only does C64 specific hints and generates a report for C64 memory map only. We need to make this configurable for other
  platforms like X16 or VIC-II - when the compiler compiles for X16 the X16 specific hints and analytics should be used instead
  The idea is to create specific analyzers for each platform.
