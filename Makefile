BIN = ./node_modules/.bin
SRC = $(wildcard src/* src/*/*)
TEST = $(wildcard test/* test/*/*)

build: index.js

index.js: src/index.js $(SRC)
	$(BIN)/rollup $< -c > $@

test.js: test/index.js $(TEST)
	$(BIN)/rollup $< -c > $@

test: test-node test-browser

test-node: test.js index.js
	node $<

test-browser: test.js index.js
	$(BIN)/browserify $< --debug | $(BIN)/tape-run

clean:
	rm -rf index.js test.js

.PHONY: build clean test test-node test-browser
