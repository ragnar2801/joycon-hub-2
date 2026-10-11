package dsa;

import java.util.Arrays;
import java.util.Objects;

/** A tiny assertion helper so the tests run with only the JDK (no JUnit download needed). */
public final class Check {
    private int passed;
    private int failed;

    /** Records a pass if {@code expected} and {@code actual} are equal (arrays compared deeply). */
    public void eq(String name, Object expected, Object actual) {
        if (Objects.deepEquals(expected, actual)) {
            passed++;
        } else {
            failed++;
            System.out.println("  FAIL " + name + ": expected " + show(expected) + " but got " + show(actual));
        }
    }

    public void isTrue(String name, boolean condition) {
        eq(name, true, condition);
    }

    public void isFalse(String name, boolean condition) {
        eq(name, false, condition);
    }

    /** Runs one topic's tests; an exception counts as a failure instead of stopping the run. */
    public void suite(String topic, Runnable tests) {
        int before = failed;
        try {
            tests.run();
        } catch (Throwable t) {
            failed++;
            System.out.println("  FAIL " + topic + " threw " + t);
        }
        System.out.println((failed == before ? "ok   " : "FAIL ") + topic);
    }

    public int failed() {
        return failed;
    }

    public String summary() {
        return passed + " passed, " + failed + " failed";
    }

    private static String show(Object value) {
        String s = Arrays.deepToString(new Object[] {value});
        return s.substring(1, s.length() - 1);
    }
}
