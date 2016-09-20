module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const printOptions = options.printOptions || {quote: 'single'};
  const root = j(file.source);

  const hasSwitch = replaceSwitch();

  if (hasSwitch) {
    appendUtilImport();
  }

  return root.toSource(printOptions);

  function replaceSwitch() {
    let hasSwitch = false;

    root
      .find(j.SwitchStatement)
      .forEach(p => {
        hasSwitch = true;

        const reducerPath = p.parent.parent;
        const reducer = reducerPath.node;

        const reducerName = reducer.id;
        const initialState = reducer.params[0].right;

        const properties = p.node.cases
          .map(switchCaseToProperty)
          .filter(_ => !!_);
        const reducerBody = j.objectExpression(properties);

        const reducerObject = j.callExpression(j.identifier('createReducer'), [initialState, reducerBody]);

        const reducerDeclaration = j.variableDeclaration(
          'const',
          [
            j.variableDeclarator(
              reducerName,
              reducerObject
            )
          ]
        );

        j(reducerPath).replaceWith(reducerDeclaration);
      });

    return hasSwitch;
  }

  function switchCaseToProperty(node) {
    const args = [
      j.identifier('state'),
      j.identifier('action')
    ];

    const body = j.blockStatement(node.consequent);
    const fn = j.functionExpression(null, args, body);

    if (!node.test) {
      return null;
    }

    const property = j.property('init', node.test, fn);

    property.method = true; // can't find constructor
    property.computed = true;
    property.shorthand = false;

    return property;
  };

  function appendUtilImport() {
    root
      .find(j.Program)
      .forEach(p => {
        p.get('body').unshift(
          j.importDeclaration(
            [
              j.importSpecifier(
                j.identifier('createReducer'),
                j.identifier('createReducer')
              )
            ],
            j.literal('./utils')
          )
        );
      });
  }
};
