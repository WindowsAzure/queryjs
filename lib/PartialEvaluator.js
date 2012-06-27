// Generated by CoffeeScript 1.3.3

/*
# 
# Copyright (c) Microsoft Corporation
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
*/


(function() {
  var IndependenceNominator, JS, PartialEvaluator, _,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  _ = require('./Utilities');

  JS = require('./JavaScriptNodes');

  /*
  # Partially evaluate a complex expression in the context of its environment.
  # This allows us to support arbitrary JavaScript expressions even though we
  # only explicitly transform a subset of expressions into QueryExpressions.
  #
  # For example, assuming we have an expression like (x) -> @id == x + 1 with an
  # environment where x == 12, then the entire right hand side of the comparison
  # is independent of any values computed by the query and could be replaced with
  # the literal value 13.
  */


  exports.PartialEvaluator = PartialEvaluator = (function(_super) {

    __extends(PartialEvaluator, _super);

    function PartialEvaluator(context) {
      this.context = context;
    }

    PartialEvaluator.prototype.visit = function(node) {
      var key, params, source, thunk, value, values, _ref, _ref1, _ref2, _ref3;
      if (!node.__independent || node.type === 'Literal' || (!node.type)) {
        /*
                        # If the node isn't independent or it's already a literal, then
                        # just keep walking the tree
        */

        return PartialEvaluator.__super__.visit.call(this, node);
      } else {
        /*
                        # Otherwse we'll evaluate the node in the context of the
                        # environment by either looking up identifiers directly or
                        # evaluating whole sub expressions
        */

        if (node.type === 'Identifier' && this.context.environment[node.name]) {
          return new JS.Literal(this.context.environment[node.name]);
        } else {
          /*
                              # Evaluate the source of the sub expression in the context
                              # of the environment
          */

          source = this.context.source.slice(node != null ? (_ref = node.range) != null ? _ref[0] : void 0 : void 0, (node != null ? (_ref1 = node.range) != null ? _ref1[1] : void 0 : void 0) + 1 || 9e9);
          params = (_ref2 = (function() {
            var _ref3, _results;
            _ref3 = this.context.environment;
            _results = [];
            for (key in _ref3) {
              value = _ref3[key];
              _results.push(key);
            }
            return _results;
          }).call(this)) != null ? _ref2 : [];
          values = (_ref3 = (function() {
            var _ref4, _results;
            _ref4 = this.context.environment;
            _results = [];
            for (key in _ref4) {
              value = _ref4[key];
              _results.push(JSON.stringify(value));
            }
            return _results;
          }).call(this)) != null ? _ref3 : [];
          thunk = "(function(" + params + ") { return " + source + "; })(" + values + ")";
          value = eval(thunk);
          return new JS.Literal(value);
        }
      }
    };

    PartialEvaluator.evaluate = function(context) {
      var evaluator, nominator;
      nominator = new IndependenceNominator(context);
      nominator.visit(context.expression);
      evaluator = new PartialEvaluator(context);
      return evaluator.visit(context.expression);
    };

    return PartialEvaluator;

  })(JS.JavaScriptVisitor);

  /*
  # Nominate independent nodes in an expression tree that don't depend on any
  # server side values.
  */


  exports.IndependenceNominator = IndependenceNominator = (function(_super) {

    __extends(IndependenceNominator, _super);

    function IndependenceNominator(context) {
      this.context = context;
    }

    IndependenceNominator.prototype.Literal = function(node) {
      IndependenceNominator.__super__.Literal.call(this, node);
      node.__independent = true;
      return node;
    };

    IndependenceNominator.prototype.ThisExpression = function(node) {
      IndependenceNominator.__super__.ThisExpression.call(this, node);
      node.__independent = false;
      return node;
    };

    IndependenceNominator.prototype.Identifier = function(node) {
      IndependenceNominator.__super__.Identifier.call(this, node);
      node.__independent = true;
      return node;
    };

    IndependenceNominator.prototype.MemberExpression = function(node) {
      var _ref, _ref1, _ref2;
      IndependenceNominator.__super__.MemberExpression.call(this, node);
      /*
                  # Undo independence of identifiers when they're members of this.* or
                  # this.member.* (the latter allows for member functions)
      */

      if ((((_ref = node.object) != null ? _ref.type : void 0) === 'ThisExpression') || (((_ref1 = node.object) != null ? _ref1.type : void 0) === 'MemberExpression' && ((_ref2 = node.object.object) != null ? _ref2.type : void 0) === 'ThisExpression')) {
        node.__independent = false;
        if (node != null) {
          node.property.__independent = false;
        }
      }
      return node;
    };

    IndependenceNominator.prototype.ObjectExpression = function(node) {
      var independence, setter, _i, _j, _len, _len1, _ref, _ref1;
      IndependenceNominator.__super__.ObjectExpression.call(this, node);
      /*
                  # Prevent literal key identifiers from being evaluated out of
                  # context
      */

      _ref = node.properties;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        setter = _ref[_i];
        setter.key.__independent = false;
      }
      /*
                  # An object literal is independent if all of its values are
                  # independent
      */

      independence = true;
      _ref1 = node.properties;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        setter = _ref1[_j];
        independence &= setter.value.__independent;
      }
      node.__independent = independence ? true : false;
      return node;
    };

    IndependenceNominator.prototype.visit = function(node) {
      /*
                  # Call the base visit method which will both visit all of our
                  # subexpressions and also call the couple of overrides above which
                  # handle the base independence cases
      */

      var independence, isIndependent, name, v, value, _i, _len;
      IndependenceNominator.__super__.visit.call(this, node);
      /*
                  # If the node's independence wasn't determined automatically by the
                  # base cases above, then it's independence is determined by checking
                  # all of its values and aggregating their independence
      */

      if (!(hasOwnProperty.call(node, '__independent'))) {
        independence = true;
        isIndependent = function(node) {
          var _ref;
          if (_.isObject(node)) {
            return (_ref = value.__independent) != null ? _ref : false;
          } else {
            return true;
          }
        };
        for (name in node) {
          value = node[name];
          if (_.isArray(value)) {
            for (_i = 0, _len = value.length; _i < _len; _i++) {
              v = value[_i];
              independence &= isIndependent(v);
            }
          } else if (_.isObject(value)) {
            independence &= isIndependent(value);
          }
        }
        /* &= will turn true/false into 1/0 so we'll turn it back
        */

        node.__independent = independence ? true : false;
      }
      return node;
    };

    return IndependenceNominator;

  })(JS.JavaScriptVisitor);

}).call(this);