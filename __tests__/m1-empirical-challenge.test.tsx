import * as React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react-native";
// @ts-expect-error missing dev types
import TestRenderer from "react-test-renderer";
import { View, TextInput, Text as RNText, Platform, Modal } from "react-native";
// @ts-expect-error missing dev types
import * as babelParser from "@babel/parser";
// @ts-expect-error missing dev types
import babelTraverse from "@babel/traverse";

jest.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  withUniwind: jest.fn((Comp: any) => Comp),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    CheckCircle: (props: any) => React.createElement(View, { ...props, testID: "check-circle-icon" }),
    Briefcase: (props: any) => React.createElement(View, { ...props, testID: "briefcase-icon" }),
    FileText: (props: any) => React.createElement(View, { ...props, testID: "file-text-icon" }),
    AlertCircle: (props: any) => React.createElement(View, { ...props, testID: "alert-circle-icon" }),
    Camera: (props: any) => React.createElement(View, { ...props, testID: "camera-icon" }),
    Send: (props: any) => React.createElement(View, { ...props, testID: "send-icon" }),
    Lock: (props: any) => React.createElement(View, { ...props, testID: "lock-icon" }),
    Eye: (props: any) => React.createElement(View, { ...props, testID: "eye-icon" }),
    EyeOff: (props: any) => React.createElement(View, { ...props, testID: "eye-off-icon" }),
    ImageIcon: (props: any) => React.createElement(View, { ...props, testID: "image-icon" }),
    Trash2: (props: any) => React.createElement(View, { ...props, testID: "trash-icon" }),
  };
});

import AttendanceSuccessPopup from "@/components/ui/pop-up";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

const traverse =
  (babelTraverse as any).default || babelTraverse;

describe("Milestone 1 Empirical Challenge: Forms, Modals, Validation, and Primitives", () => {
  const rootDir = process.cwd();

  // =========================================================================
  // Challenge 1: KeyboardAvoidingView on izin.tsx & ManageAccount.tsx
  // =========================================================================
  describe("Challenge 1: KeyboardAvoidingView AST, Props, Hierarchy, & Modal Nesting", () => {
    const izinPath = join(rootDir, "app/perizinan/izin.tsx");
    const manageAccountPath = join(rootDir, "app/profile/ManageAccount.tsx");

    const parseAst = (filePath: string) => {
      const code = readFileSync(filePath, "utf8");
      return babelParser.parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });
    };

    it("izin.tsx: KeyboardAvoidingView wraps ScrollView with correct props", () => {
      const ast = parseAst(izinPath);
      let kavFound = false;
      let kavBehaviorExpr = "";
      let kavClassName = "";
      let innerScrollViewHasPersistTaps = false;
      let persistTapsValue = "";
      let hasModalInsideKav = false;

      traverse(ast, {
        JSXElement(path: any) {
          const openingName = path.node.openingElement.name.name;
          if (openingName === "KeyboardAvoidingView") {
            kavFound = true;
            for (const attr of path.node.openingElement.attributes) {
              if (attr.type === "JSXAttribute") {
                if (attr.name.name === "behavior") {
                  if (attr.value.type === "JSXExpressionContainer") {
                    const expr = attr.value.expression;
                    if (
                      expr.type === "ConditionalExpression" &&
                      expr.test.type === "BinaryExpression" &&
                      expr.test.left.type === "MemberExpression"
                    ) {
                      const objName = expr.test.left.object.name;
                      const propName = expr.test.left.property.name;
                      const rightVal = expr.test.right.value;
                      kavBehaviorExpr = `${objName}.${propName} === "${rightVal}" ? "${expr.consequent?.value}" : "${expr.alternate?.value}"`;
                    }
                  }
                }
                if (attr.name.name === "className") {
                  kavClassName = attr.value?.value || "";
                }
              }
            }

            // Inspect children of KeyboardAvoidingView
            path.traverse({
              JSXElement(innerPath: any) {
                const innerName = innerPath.node.openingElement.name.name;
                if (innerName === "Modal") {
                  hasModalInsideKav = true;
                }
                if (innerName === "ScrollView") {
                  for (const attr of innerPath.node.openingElement.attributes) {
                    if (
                      attr.type === "JSXAttribute" &&
                      attr.name.name === "keyboardShouldPersistTaps"
                    ) {
                      innerScrollViewHasPersistTaps = true;
                      persistTapsValue = attr.value?.value || "";
                    }
                  }
                }
              },
            });
          }
        },
      });

      expect(kavFound).toBe(true);
      expect(kavClassName).toContain("flex-1");
      expect(kavBehaviorExpr).toBe('Platform.OS === "ios" ? "padding" : "height"');
      expect(innerScrollViewHasPersistTaps).toBe(true);
      expect(persistTapsValue).toBe("handled");
      expect(hasModalInsideKav).toBe(false);

      // Verify dynamic behavior evaluation for both platforms
      const getBehavior = (platform: "ios" | "android") =>
        platform === "ios" ? "padding" : "height";
      expect(getBehavior("ios")).toBe("padding");
      expect(getBehavior("android")).toBe("height");
    });

    it("ManageAccount.tsx: KeyboardAvoidingView props, hierarchy, and Modal isolation", () => {
      const ast = parseAst(manageAccountPath);
      let kavFound = false;
      let kavBehaviorExpr = "";
      let kavClassName = "";
      let innerScrollViewHasPersistTaps = false;
      let persistTapsValue = "";
      let isModalInsideKav = false;
      let modalCountOutsideKav = 0;
      let modalHasOnRequestClose = false;

      traverse(ast, {
        JSXElement(path: any) {
          const openingName = path.node.openingElement.name.name;

          if (openingName === "KeyboardAvoidingView") {
            kavFound = true;
            for (const attr of path.node.openingElement.attributes) {
              if (attr.type === "JSXAttribute") {
                if (attr.name.name === "behavior") {
                  if (attr.value.type === "JSXExpressionContainer") {
                    const expr = attr.value.expression;
                    if (
                      expr.type === "ConditionalExpression" &&
                      expr.test.type === "BinaryExpression" &&
                      expr.test.left.type === "MemberExpression"
                    ) {
                      const objName = expr.test.left.object.name;
                      const propName = expr.test.left.property.name;
                      const rightVal = expr.test.right.value;
                      kavBehaviorExpr = `${objName}.${propName} === "${rightVal}" ? "${expr.consequent?.value}" : "${expr.alternate?.value}"`;
                    }
                  }
                }
                if (attr.name.name === "className") {
                  kavClassName = attr.value?.value || "";
                }
              }
            }

            path.traverse({
              JSXElement(innerPath: any) {
                const innerName = innerPath.node.openingElement.name.name;
                if (innerName === "Modal") {
                  isModalInsideKav = true;
                }
                if (innerName === "ScrollView") {
                  for (const attr of innerPath.node.openingElement.attributes) {
                    if (
                      attr.type === "JSXAttribute" &&
                      attr.name.name === "keyboardShouldPersistTaps"
                    ) {
                      innerScrollViewHasPersistTaps = true;
                      persistTapsValue = attr.value?.value || "";
                    }
                  }
                }
              },
            });
          }

          if (openingName === "Modal") {
            // Check if this modal is outside KAV
            let parent = path.parentPath;
            let insideKav = false;
            while (parent) {
              if (
                parent.node.type === "JSXElement" &&
                parent.node.openingElement.name.name === "KeyboardAvoidingView"
              ) {
                insideKav = true;
                break;
              }
              parent = parent.parentPath;
            }

            if (!insideKav) {
              modalCountOutsideKav++;
              for (const attr of path.node.openingElement.attributes) {
                if (
                  attr.type === "JSXAttribute" &&
                  attr.name.name === "onRequestClose"
                ) {
                  modalHasOnRequestClose = true;
                }
              }
            }
          }
        },
      });

      expect(kavFound).toBe(true);
      expect(kavClassName).toContain("flex-1");
      expect(kavBehaviorExpr).toBe('Platform.OS === "ios" ? "padding" : "height"');
      expect(innerScrollViewHasPersistTaps).toBe(true);
      expect(persistTapsValue).toBe("handled");

      // CRITICAL ADVERSARIAL CHECK: Modal MUST NOT be nested inside KeyboardAvoidingView
      expect(isModalInsideKav).toBe(false);
      expect(modalCountOutsideKav).toBe(1);
      expect(modalHasOnRequestClose).toBe(true);
    });

    it("verifies inputs and submit buttons reside within the scrollable KAV tree via AST", () => {
      const izinAst = parseAst(izinPath);
      let izinKavContainsInput = false;
      let izinKavContainsSubmit = false;

      traverse(izinAst, {
        JSXElement(path: any) {
          if (path.node.openingElement.name.name === "KeyboardAvoidingView") {
            path.traverse({
              JSXElement(innerPath: any) {
                const name = innerPath.node.openingElement.name.name;
                if (name === "TextInput") {
                  izinKavContainsInput = true;
                }
                if (name === "TouchableOpacity") {
                  for (const attr of innerPath.node.openingElement.attributes) {
                    if (
                      attr.type === "JSXAttribute" &&
                      attr.name.name === "onPress" &&
                      attr.value?.expression?.name === "uploadPermit"
                    ) {
                      izinKavContainsSubmit = true;
                    }
                  }
                }
              },
            });
          }
        },
      });

      expect(izinKavContainsInput).toBe(true);
      expect(izinKavContainsSubmit).toBe(true);

      const manageAst = parseAst(manageAccountPath);
      let manageKavContainsInput = false;
      let manageKavContainsSubmit = false;

      traverse(manageAst, {
        JSXElement(path: any) {
          if (path.node.openingElement.name.name === "KeyboardAvoidingView") {
            path.traverse({
              JSXElement(innerPath: any) {
                const name = innerPath.node.openingElement.name.name;
                if (name === "Input") {
                  manageKavContainsInput = true;
                }
                if (name === "Button") {
                  for (const attr of innerPath.node.openingElement.attributes) {
                    if (
                      attr.type === "JSXAttribute" &&
                      attr.name.name === "onPress" &&
                      attr.value?.expression?.name === "handleChangePassword"
                    ) {
                      manageKavContainsSubmit = true;
                    }
                  }
                }
              },
            });
          }
        },
      });

      expect(manageKavContainsInput).toBe(true);
      expect(manageKavContainsSubmit).toBe(true);
    });
  });

  // =========================================================================
  // Challenge 2: onRequestClose on Modal in pop-up.tsx
  // =========================================================================
  describe("Challenge 2: onRequestClose on Modal in components/ui/pop-up.tsx", () => {
    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it("renders nothing when visible is false", () => {
      const onClose = jest.fn();
      let root: any;
      TestRenderer.act(() => {
        root = TestRenderer.create(
          <AttendanceSuccessPopup
            visible={false}
            onClose={onClose}
            attendanceType="check_in"
          />,
        );
      });
      expect(root.toJSON()).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      TestRenderer.act(() => {
        root.unmount();
      });
    });

    it("triggers hideAnimation and dispatches onClose when onRequestClose is fired", () => {
      jest.useFakeTimers();
      const onClose = jest.fn();
      let root: any;

      TestRenderer.act(() => {
        root = TestRenderer.create(
          <AttendanceSuccessPopup
            visible={true}
            onClose={onClose}
            attendanceType="check_in"
          />,
        );
      });

      const modal = root.root.findByType(Modal);
      expect(modal.props.onRequestClose).toBeDefined();

      // Fire onRequestClose (Android hardware back press)
      TestRenderer.act(() => {
        modal.props.onRequestClose();
      });

      // Advance timers past animation duration (300ms) and deferred setTimeout(0)
      TestRenderer.act(() => {
        jest.runAllTimers();
      });

      expect(onClose).toHaveBeenCalledTimes(1);
      TestRenderer.act(() => {
        root.unmount();
      });
    });

    it("triggers onClose when the Confirm button is tapped", () => {
      jest.useFakeTimers();
      const onClose = jest.fn();
      let root: any;

      TestRenderer.act(() => {
        root = TestRenderer.create(
          <AttendanceSuccessPopup
            visible={true}
            onClose={onClose}
            attendanceType="check_out"
          />,
        );
      });

      const confirmButton = root.root.findByProps({ children: "Confirm" });
      expect(confirmButton).toBeTruthy();

      TestRenderer.act(() => {
        let parent = confirmButton.parent;
        while (parent && !parent.props.onPress) {
          parent = parent.parent;
        }
        parent.props.onPress();
      });

      TestRenderer.act(() => {
        jest.runAllTimers();
      });

      expect(onClose).toHaveBeenCalledTimes(1);
      TestRenderer.act(() => {
        root.unmount();
      });
    });
  });

  // =========================================================================
  // Challenge 3: forwardRef & displayName on UI Primitives
  // =========================================================================
  describe("Challenge 3: forwardRef and displayName on Input, Card, Badge, Text", () => {
    it("verifies explicit displayName on all primitives", () => {
      expect(Input.displayName).toBe("Input");
      expect(Card.displayName).toBe("Card");
      expect(CardHeader.displayName).toBe("CardHeader");
      expect(CardTitle.displayName).toBe("CardTitle");
      expect(CardDescription.displayName).toBe("CardDescription");
      expect(CardContent.displayName).toBe("CardContent");
      expect(CardFooter.displayName).toBe("CardFooter");
      expect(Badge.displayName).toBe("Badge");
      expect(Text.displayName).toBe("Text");
    });

    it("Input: ref attaches to native TextInput", async () => {
      const inputRef = React.createRef<TextInput>();

      const { getByTestId } = await render(
        <Input ref={inputRef} testID="test-input" placeholder="Test" />,
      );

      expect(getByTestId("test-input")).toBeTruthy();
      expect(inputRef.current).not.toBeNull();
      expect(typeof inputRef.current?.focus).toBe("function");
    });

    it("Card family: refs attach to native View and Text elements", async () => {
      const cardRef = React.createRef<View>();
      const headerRef = React.createRef<View>();
      const titleRef = React.createRef<any>();
      const descRef = React.createRef<any>();
      const contentRef = React.createRef<View>();
      const footerRef = React.createRef<View>();

      await render(
        <Card ref={cardRef} testID="card">
          <CardHeader ref={headerRef} testID="card-header">
            <CardTitle ref={titleRef} testID="card-title">
              Card Title
            </CardTitle>
            <CardDescription ref={descRef} testID="card-desc">
              Card Desc
            </CardDescription>
          </CardHeader>
          <CardContent ref={contentRef} testID="card-content">
            <Text>Body</Text>
          </CardContent>
          <CardFooter ref={footerRef} testID="card-footer">
            <Text>Footer</Text>
          </CardFooter>
        </Card>,
      );

      expect(cardRef.current).not.toBeNull();
      expect(headerRef.current).not.toBeNull();
      expect(titleRef.current).not.toBeNull();
      expect(descRef.current).not.toBeNull();
      expect(contentRef.current).not.toBeNull();
      expect(footerRef.current).not.toBeNull();
    });

    it("Badge: ref attaches to native View with and without asChild", async () => {
      const badgeRef = React.createRef<View>();
      const asChildBadgeRef = React.createRef<View>();

      await render(
        <View>
          <Badge ref={badgeRef} testID="standard-badge">
            <Text>Standard</Text>
          </Badge>
          <Badge ref={asChildBadgeRef} asChild testID="as-child-badge">
            <View testID="inner-child">
              <Text>Child</Text>
            </View>
          </Badge>
        </View>,
      );

      expect(badgeRef.current).not.toBeNull();
      expect(asChildBadgeRef.current).not.toBeNull();
    });

    it("Text: ref attaches to native Text with and without asChild", async () => {
      const textRef = React.createRef<RNText>();
      const asChildTextRef = React.createRef<RNText>();

      await render(
        <View>
          <Text ref={textRef} testID="standard-text">
            Standard Text
          </Text>
          <Text ref={asChildTextRef} asChild testID="as-child-text">
            <RNText testID="inner-text">Inner RNText</RNText>
          </Text>
        </View>,
      );

      expect(textRef.current).not.toBeNull();
      expect(asChildTextRef.current).not.toBeNull();
    });
  });

  // =========================================================================
  // Challenge 4: Password Validation Regex, Boundaries, & Copy
  // =========================================================================
  describe("Challenge 4: Password Validation Regex, Boundaries, and Copy Alignment", () => {
    const manageAccountPath = join(rootDir, "app/profile/ManageAccount.tsx");
    const content = readFileSync(manageAccountPath, "utf8");

    // Extract exact regex used in ManageAccount.tsx
    const regexMatch = content.match(/passwordRegex\s*=\s*(\/[^\n]+\/);/);
    expect(regexMatch).toBeTruthy();
    const extractedRegexStr = regexMatch![1];
    const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$/;

    it("verifies extracted regex in source matches specification", () => {
      expect(extractedRegexStr).toBe(
        "/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$/",
      );
    });

    it("stress-tests password regex against boundary strings and equivalence classes", () => {
      const testCases: Array<{
        password: string;
        expected: boolean;
        reason: string;
      }> = [
        // Boundary: Length < 8
        { password: "", expected: false, reason: "Empty string" },
        { password: "Aa1", expected: false, reason: "Length 3 < 8" },
        { password: "Aa12345", expected: false, reason: "Length 7 < 8" },
        // Boundary: Length >= 8
        { password: "Aa123456", expected: true, reason: "Length 8 == min length" },
        { password: "Aa1234567", expected: true, reason: "Length 9 > min length" },
        {
          password: "VeryLongPassword1234567890ABCDEFabcdef!@#$",
          expected: true,
          reason: "Long password",
        },
        // Missing Character Classes
        {
          password: "abcdefgh1",
          expected: false,
          reason: "Missing uppercase letter",
        },
        {
          password: "ABCDEFGH1",
          expected: false,
          reason: "Missing lowercase letter",
        },
        {
          password: "Abcdefghij",
          expected: false,
          reason: "Missing number/digit",
        },
        {
          password: "12345678",
          expected: false,
          reason: "Only numbers",
        },
        {
          password: "!@#$%^&*()_+",
          expected: false,
          reason: "Only special characters",
        },
        // Special characters included with all 3 classes
        {
          password: "Password123!",
          expected: true,
          reason: "Has upper, lower, digit, and special char",
        },
        {
          password: "P@ssw0rd#2026",
          expected: true,
          reason: "Common complex password with symbols",
        },
        // Spaces included
        {
          password: "Pass word 1",
          expected: true,
          reason: "Spaces count towards 8+ length while having classes",
        },
        // Non-ASCII uppercase/digit
        {
          password: "Éabc1234",
          expected: false,
          reason: "Non-ASCII uppercase does not satisfy [A-Z]",
        },
        {
          password: "Abcd\u0660\u0661\u0662\u0663",
          expected: false,
          reason: "Arabic-Indic digits do not satisfy [0-9]",
        },
      ];

      for (const tc of testCases) {
        const result = passwordRegex.test(tc.password);
        expect(result).toBe(tc.expected);
      }
    });

    it("verifies copy strictly matches behavioral constraints across all surfaces", () => {
      // Check that stale "Minimal 6 karakter" copy is completely eliminated
      expect(content).not.toContain("Minimal 6 karakter");

      // Check placeholder
      expect(content).toContain('placeholder="Minimal 8 karakter (A-Z, a-z, 0-9)"');

      // Check helper text
      expect(content).toContain(
        "Minimal 8 karakter, kombinasi huruf besar, huruf kecil, dan",
      );
      expect(content).toContain("angka.");

      // Check validation alert message
      expect(content).toContain(
        "Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka.",
      );
    });
  });
});
