# Blend65 Imports

Imports in blend are like the following:

1. Imports:

```js
import someFunc from some.lib
import
    someFunc1,
    someFunc2,
    someFunc3,
from
    another.lib
```

2. we don't have imports from while card libs:

```js
import
    func1,
    func2,
from
    all.*   //  <---- WE DON"T HAVE THIS (ANYMORE)  -> Specs need update
```

3. we have wild card imports like:

```js
    import * from some.lib // THIS IS OK :)
```

# Exports

1. We dont have re-exports like:

```js
import func1 from some.lib

export func1 // WE DIN't HAVE THIS (Maybe in the future)
```
