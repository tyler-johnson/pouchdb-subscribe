BIN = ./node_modules/.bin
SRC = $(wildcard src/* src/*/*)
TEST = $(wildcard test/* test/*/*)

build: index.js browser.js dist/browser.min.js

index.js: src/index.js $(SRC)
	$(BIN)/rollup $< -c build/rollup.node.js > $@

browser.js: src/index.js $(SRC)
	$(BIN)/rollup $< -c build/rollup.browser.js > $@

dist:
	mkdir -p $@

dist/browser.js: src/index.js $(SRC) dist
	$(BIN)/rollup $< -c build/rollup.full.js > $@

dist/browser.min.js: dist/browser.js
	$(BIN)/uglifyjs $< -mc warnings=false > $@

test.js: test/index.js $(TEST)
	$(BIN)/rollup $< -c build/rollup.node.js > $@

test: test-node test-browser

test-node: test.js index.js
	node $<

test-browser: test.js browser.js
	$(BIN)/browserify $< --debug | $(BIN)/tape-run

clean:
	rm -rf index.js browser.js test.js dist/

.PHONY: build clean test test-node test-browser
