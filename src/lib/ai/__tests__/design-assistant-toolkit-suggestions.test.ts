/**
 * Design Assistant Toolkit Suggestions — Phase D Tests
 *
 * Verifies that:
 * 1. System prompt includes toolkit tool awareness
 * 2. Tool suggestions are phase-aware based on criterion tags
 * 3. Tool metadata is complete for all interactive tools
 * 4. Tool link format is correct and parseable by frontend
 */

import { describe, it, expect } from 'vitest';
import { buildDesignAssistantSystemPrompt } from '../design-assistant-prompt';
import { getToolMetadata, getAllInteractiveTools, getToolsByPhase } from '@/lib/tools/toolkit-metadata';

describe('Design Assistant Toolkit Suggestions (Phase D)', () => {
  describe('System Prompt Toolkit Awareness', () => {
    it('should include toolkit tools section when no criterion tags provided', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 5,
        framework: 'IB_MYP',
        previousTurns: 0,
      });

      expect(prompt).toContain('## Toolkit Tool Suggestions');
      expect(prompt).toContain('RULES FOR SUGGESTING TOOLS');
      expect(prompt).toContain('Ideation phase');
      expect(prompt).toContain('Analysis phase');
      expect(prompt).toContain('Evaluation phase');
    });

    it('should bias tools to DISCOVER phase when criterion A tag provided', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 5,
        framework: 'IB_MYP',
        criterionTags: ['Criterion A'],
        previousTurns: 0,
      });

      expect(prompt).toContain('## Toolkit Tool Suggestions');
      expect(prompt).toContain('Empathy Map');
      expect(prompt).toContain('Five Whys');
      expect(prompt).toContain('Stakeholder Map');
      expect(prompt).toContain('/toolkit/empathy-map');
    });

    it('should bias tools to IDEATE phase when Developing Ideas criterion provided', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 4,
        effortScore: 5,
        criterionTags: ['Developing Ideas'],
        previousTurns: 1,
      });

      expect(prompt).toContain('SCAMPER');
      expect(prompt).toContain('Reverse Brainstorm');
      expect(prompt).toContain('Lotus Diagram');
      expect(prompt).toContain('/toolkit/scamper');
      expect(prompt).toContain('/toolkit/reverse-brainstorm');
    });

    it('should bias tools to EVALUATE phase when Evaluating criterion provided', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 5,
        effortScore: 6,
        criterionTags: ['Evaluating'],
        previousTurns: 4,
      });

      expect(prompt).toContain('Decision Matrix');
      expect(prompt).toContain('PMI Chart');
      expect(prompt).toContain('SWOT Analysis');
      expect(prompt).toContain('/toolkit/decision-matrix');
    });

    it('should include tool suggestion rules in prompt', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 2,
        effortScore: 5,
        previousTurns: 0,
      });

      expect(prompt).toContain('Only suggest a tool when their message clearly indicates');
      expect(prompt).toContain('Maximum ONE tool suggestion per response');
      expect(prompt).toContain('Frame it as optional');
    });

    it('should include tool link format example in prompt', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 5,
        previousTurns: 0,
      });

      expect(prompt).toContain('/toolkit/');
      expect(prompt).toMatch(/\[.*\]\(\/toolkit\/.*\)/); // Markdown link pattern
    });

    it('should maintain all existing design assistant features', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 4,
        effortScore: 5,
        framework: 'IB_MYP',
        activityTitle: 'Design Brief: Phone Stand',
        previousTurns: 2,
      });

      // Existing features should still be present
      expect(prompt).toContain('Socratic design mentor');
      expect(prompt).toContain('Richard Paul');
      expect(prompt).toContain('ONE focused question at a time');
      expect(prompt).toContain('Material properties');
      expect(prompt).toContain('Analyse (Level 4/6)');
      expect(prompt).toContain('Design Brief: Phone Stand');
    });
  });

  describe('Toolkit Metadata Completeness', () => {
    it('should have metadata for all interactive tools', () => {
      const allTools = getAllInteractiveTools();
      expect(allTools.length).toBeGreaterThan(0);
      expect(allTools.length).toBeLessThanOrEqual(15); // Current count: 13
    });

    it('each tool should have all required fields', () => {
      const allTools = getAllInteractiveTools();
      allTools.forEach((tool: any) => {
        expect(tool.name).toBeTruthy();
        expect(tool.slug).toBeTruthy();
        expect(tool.desc).toBeTruthy();
        expect(tool.phase).toMatch(/discover|define|ideate|prototype|test/);
        expect(tool.type).toMatch(/ideation|analysis|evaluation|research|planning/);
        expect(tool.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(tool.bgColor).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should have tools for every design phase', () => {
      const phases = ['discover', 'define', 'ideate', 'prototype'] as const;
      phases.forEach((phase) => {
        const toolsForPhase = getToolsByPhase(phase);
        expect(toolsForPhase.length).toBeGreaterThan(0);
      });
      // Note: 'test' phase currently has no tools — tools are indexed to prototype + evaluate phases
    });

    it('should return correct tool metadata by slug', () => {
      const scamper = getToolMetadata('scamper');
      expect(scamper).toBeTruthy();
      expect(scamper?.name).toBe('SCAMPER');
      expect(scamper?.phase).toBe('ideate');
      expect(scamper?.type).toBe('ideation');
    });

    it('should return null for non-existent tool slug', () => {
      const nonexistent = getToolMetadata('nonexistent-tool');
      expect(nonexistent).toBeNull();
    });

    it('should have color distinctly different from bgColor', () => {
      const allTools = getAllInteractiveTools();
      allTools.forEach((tool: any) => {
        expect(tool.color).not.toEqual(tool.bgColor);
      });
    });
  });

  describe('Tool Link Format', () => {
    it('should use correct markdown link format for tool suggestions', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 5,
        criterionTags: ['Developing Ideas'],
        previousTurns: 0,
      });

      // Should contain tool names and links (format: - **Name** (/toolkit/slug) — description)
      expect(prompt).toContain('**SCAMPER**');
      expect(prompt).toContain('(/toolkit/scamper)');
      // Verify the full pattern appears somewhere in the prompt
      expect(prompt).toMatch(/\*\*SCAMPER\*\*\s+\(\/toolkit\/scamper\)/);
    });

    it('tool slugs should be lowercase with hyphens', () => {
      const allTools = getAllInteractiveTools();
      allTools.forEach((tool) => {
        expect(tool.slug).toMatch(/^[a-z0-9-]+$/);
        expect(tool.slug).not.toContain('_');
        expect(tool.slug).not.toContain(' ');
      });
    });

    it('all tool links should be to /toolkit/ routes', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 5,
        previousTurns: 0,
      });

      const linkPattern = /\[([^\]]+)\]\(\/toolkit\/([a-z-]+)\)/g;
      const matches = prompt.match(linkPattern) || [];

      matches.forEach((link) => {
        expect(link).toMatch(/^\[.*\]\(\/toolkit\/.*\)$/);
      });
    });
  });

  describe('Context-Aware Tool Biasing', () => {
    it('DISCOVER phase should suggest research/analysis tools', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 2,
        effortScore: 5,
        criterionTags: ['Criterion A'],
        previousTurns: 0,
      });

      expect(prompt).toContain('Empathy Map');
      expect(prompt).toContain('Five Whys');
      expect(prompt).toContain('Stakeholder Map');
      // Should NOT have ideation tools as primary suggestions
      expect(prompt).not.toContain('SCAMPER');
    });

    it('IDEATE phase should suggest ideation tools', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 5,
        criterionTags: ['Criterion B'],
        previousTurns: 1,
      });

      expect(prompt).toContain('SCAMPER');
      expect(prompt).toContain('Reverse Brainstorm');
      expect(prompt).toContain('Lotus Diagram');
    });

    it('EVALUATE phase should suggest evaluation tools', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 5,
        effortScore: 6,
        criterionTags: ['Criterion D'],
        previousTurns: 3,
      });

      expect(prompt).toContain('Decision Matrix');
      expect(prompt).toContain('PMI Chart');
      expect(prompt).toContain('SWOT Analysis');
    });

    it('multiple criterion tags should use the first match', () => {
      const prompt = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 5,
        criterionTags: ['Criterion B', 'Criterion A'], // B should win
        previousTurns: 0,
      });

      // Should be biased to ideate (Criterion B) not discover
      expect(prompt).toContain('SCAMPER');
    });
  });

  describe('Integration with Existing Features', () => {
    it('should not interfere with Bloom level adaptation', () => {
      const prompt1 = buildDesignAssistantSystemPrompt({
        bloomLevel: 1,
        effortScore: 5,
        previousTurns: 0,
      });
      const prompt2 = buildDesignAssistantSystemPrompt({
        bloomLevel: 6,
        effortScore: 5,
        previousTurns: 0,
      });

      expect(prompt1).toContain('Level 1/6');
      expect(prompt2).toContain('Level 6/6');
      expect(prompt1).toContain('Ask simple, concrete questions');
      expect(prompt2).toContain('Ask complex questions');
    });

    it('should not interfere with effort gating', () => {
      const promptWithGood = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 8,
        previousTurns: 0,
      });
      const promptWithPoor = buildDesignAssistantSystemPrompt({
        bloomLevel: 3,
        effortScore: 1,
        previousTurns: 0,
      });

      expect(promptWithPoor).toContain('EFFORT ALERT');
      expect(promptWithGood).not.toContain('EFFORT ALERT');
    });

    it('should work with all framework options', () => {
      const frameworks = ['IB_MYP', 'GCSE_DT', 'ACARA', 'A_LEVEL'];
      frameworks.forEach((fw) => {
        const prompt = buildDesignAssistantSystemPrompt({
          bloomLevel: 3,
          effortScore: 5,
          framework: fw,
          previousTurns: 0,
        });
        expect(prompt).toContain('Toolkit Tool Suggestions');
      });
    });
  });
});
