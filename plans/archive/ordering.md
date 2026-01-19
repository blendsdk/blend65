# Blend Language Ordering

Blend65 is eventually mean to compile to 6502 assembly.
This is how the source codes are meant to be organized and worked

1. a file can only have a single `module` declaration. If a file does not have a module declaration then we default to `module global`
1.1 encountering a real `module` after the implicit `global` will trigger error! We either have a `module` declaration at beginning of the file (comments and whitespace exluded) or we don't and fall back to `module global`
2. a module declaration can only have global storage variables, and functions like:

   ```js
       @zp let someVar:byte  // optional initialization

       function someFunc():void
       end function

       export function main():void
       end function
   ```

3. Global functions and variables can be exported using `export` to be availble if other modules
4. There must be only one exported main function regardless of how many source files are in the AST. The main function will be the entry point of the application - also the entry point of the final assembly.
5. constants `const` variables must be initialized. (task forthe analyzer)
6. there can be no global function calls:
    ```js
        module Game

        @zp let lastLevel = loadLastLevel() // THIS IS OK 

        function loadLastLevel():byte
            return 2
        function

        function init(): void
        end function

        export function main():void
        end function

        init()   // THIS IS NOT OK
    ```
7. the `main` function must always be exported by `export`, if not prefixed with `export` then we implictly mark it as export
