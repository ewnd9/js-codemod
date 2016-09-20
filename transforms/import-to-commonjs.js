module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const printOptions = options.printOptions || {quote: 'single'};
  const root = j(file.source);

  root
    .find(j.ImportDeclaration)
    .forEach(p => {
      const specifiers = p.node.specifiers;

      if (specifiers.length === 1 && specifiers[0].type === 'ImportDefaultSpecifier') {
        j(p).replaceWith(
          createConst(
            specifiers[0].local,
            createRequire(p.node.source)
          )
        );
      } else if (specifiers.every(s => s.type !== 'ImportDefaultSpecifier')) {
        j(p).replaceWith(
          createConst(
            createObjFromSpecifiers(specifiers),
            createRequire(p.node.source)
          )
        );
      } else {
        const defaultSpecifier = specifiers.find(s => s.type === 'ImportDefaultSpecifier');
        const path = j(p);
        
        path.replaceWith(
          createConst(
            defaultSpecifier.local,
            createRequire(p.node.source)
          )
        );

        path.insertAfter(
          createConst(
            createObjFromSpecifiers(
              specifiers.filter(s => s.type !== 'ImportDefaultSpecifier')
            ),
            defaultSpecifier.local
          )
        );
      }
    });

  return root.toSource(printOptions);

  function createConst(leftSide, rightSide) {
    return j.variableDeclaration('const', [
      j.variableDeclarator(
        leftSide,
        rightSide
      )
    ]);
  }

  function createRequire(source) {
    return j.callExpression(j.identifier('require'), [source]);
  }

  function createObjFromSpecifiers(specifiers) {
    return j.objectPattern(
      specifiers
        .map(s => {
          const p = j.property('init', s.imported, s.local);
          p.shorthand = s.local.name === s.imported.name;

          return p;
        })
    );
  }
};
