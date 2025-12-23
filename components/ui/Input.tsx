/**
 * Reusable Input Component
 * Consistent input styling with validation states
 */

import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    ViewStyle,
    TextInputProps,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: keyof typeof Ionicons.glyphMap;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    onRightIconPress?: () => void;
    containerStyle?: ViewStyle;
    required?: boolean;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    required = false,
    ...textInputProps
}) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <View style={styles.labelContainer}>
                    <Text style={styles.label}>
                        {label}
                        {required && <Text style={styles.required}> *</Text>}
                    </Text>
                </View>
            )}

            <View
                style={[
                    styles.inputContainer,
                    isFocused && styles.inputContainerFocused,
                    error && styles.inputContainerError,
                ]}
            >
                {leftIcon && (
                    <Ionicons
                        name={leftIcon}
                        size={20}
                        color={theme.colors.text.tertiary}
                        style={styles.leftIcon}
                    />
                )}

                <TextInput
                    style={[
                        styles.input,
                        leftIcon && styles.inputWithLeftIcon,
                        rightIcon && styles.inputWithRightIcon,
                    ]}
                    placeholderTextColor={theme.colors.text.disabled}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...textInputProps}
                />

                {rightIcon && (
                    <TouchableOpacity
                        onPress={onRightIconPress}
                        style={styles.rightIconContainer}
                        disabled={!onRightIconPress}
                    >
                        <Ionicons
                            name={rightIcon}
                            size={20}
                            color={theme.colors.text.tertiary}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {error && (
                <View style={styles.messageContainer}>
                    <Ionicons
                        name="alert-circle"
                        size={14}
                        color={theme.colors.error.main}
                        style={styles.messageIcon}
                    />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {hint && !error && (
                <Text style={styles.hintText}>{hint}</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },
    labelContainer: {
        marginBottom: theme.spacing.sm,
    },
    label: {
        ...theme.typography.styles.bodyMedium,
        color: theme.colors.text.secondary,
    },
    required: {
        color: theme.colors.error.main,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background.tertiary,
        borderRadius: theme.borderRadius.md,
        borderWidth: 2,
        borderColor: 'transparent',
        paddingHorizontal: theme.spacing.md,
        minHeight: 52,
    },
    inputContainerFocused: {
        borderColor: theme.colors.primary[500],
        backgroundColor: theme.colors.background.secondary,
    },
    inputContainerError: {
        borderColor: theme.colors.error.main,
    },
    input: {
        flex: 1,
        ...theme.typography.styles.body,
        color: theme.colors.text.primary,
        paddingVertical: theme.spacing.md,
    },
    inputWithLeftIcon: {
        marginLeft: theme.spacing.sm,
    },
    inputWithRightIcon: {
        marginRight: theme.spacing.sm,
    },
    leftIcon: {
        marginRight: theme.spacing.xs,
    },
    rightIconContainer: {
        padding: theme.spacing.xs,
    },
    messageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing.sm,
    },
    messageIcon: {
        marginRight: theme.spacing.xs,
    },
    errorText: {
        ...theme.typography.styles.caption,
        color: theme.colors.error.main,
    },
    hintText: {
        ...theme.typography.styles.caption,
        color: theme.colors.text.tertiary,
        marginTop: theme.spacing.sm,
    },
});
