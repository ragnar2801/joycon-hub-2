#!/usr/bin/env sh
# Compiles every solution and test with plain javac, then runs them all. Needs JDK 17+.
set -e
cd "$(dirname "$0")"
rm -rf out
javac -d out $(find src test -name '*.java')
java -cp out dsa.AllTests
