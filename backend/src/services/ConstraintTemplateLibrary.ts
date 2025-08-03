import { SchedulingConstraint } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import moment from 'moment';

export interface ConstraintTemplate {
  id: string;
  name: string;
  description: string;
  category: 'HOLIDAY' | 'SEASONAL' | 'SPECIAL_EVENT' | 'MAINTENANCE' | 'TRAINING' | 'EMERGENCY' | 'CUSTOM';
  tags: string[];
  popularity: number; // Usage count
  rating: number; // User rating 1-5
  constraints: Array<{
    constraintType: 'BLACKOUT_DATE' | 'MAX_SCREENER_DAYS' | 'MIN_SCREENER_DAYS' | 'PREFERRED_SCREENER' | 'UNAVAILABLE_SCREENER' | 'MIN_COVERAGE' | 'OVERTIME_ALLOWED';
    parameters: Record<string, any>;
    isRequired: boolean;
    description: string;
    applicableAnalysts?: string[]; // If specified, only applies to these analysts
  }>;
  variables: Array<{
    name: string;
    type: 'DATE' | 'NUMBER' | 'TEXT' | 'ANALYST_ID' | 'ANALYST_LIST' | 'BOOLEAN';
    description: string;
    defaultValue?: any;
    required: boolean;
    validationRules?: Record<string, any>;
  }>;
  usage: {
    timesUsed: number;
    lastUsed?: Date;
    successRate: number; // Percentage of successful applications
    averageRating: number;
    feedback: Array<{
      userId: string;
      rating: number;
      comment?: string;
      createdAt: Date;
    }>;
  };
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    version: string;
    isPublic: boolean;
    isVerified: boolean; // Verified by administrators
  };
}

export interface TemplateApplication {
  templateId: string;
  variables: Record<string, any>;
  targetDate?: Date;
  targetDateRange?: { startDate: Date; endDate: Date };
  applicableAnalysts?: string[];
  previewMode?: boolean;
}

export interface TemplateApplicationResult {
  success: boolean;
  constraintsCreated: number;
  constraintIds: string[];
  errors: Array<{
    constraintIndex: number;
    error: string;
    details?: any;
  }>;
  warnings: Array<{
    constraintIndex: number;
    warning: string;
    impact?: string;
  }>;
  preview?: Array<{
    constraintType: string;
    description: string;
    parameters: Record<string, any>;
    wouldConflict: boolean;
  }>;
  impact: {
    affectedDates: number;
    affectedAnalysts: number;
    estimatedConflicts: number;
  };
}

export interface TemplateSearchFilters {
  category?: string;
  tags?: string[];
  minRating?: number;
  createdBy?: string;
  isPublic?: boolean;
  isVerified?: boolean;
  textSearch?: string;
}

export class ConstraintTemplateLibrary {
  private templates: Map<string, ConstraintTemplate> = new Map();

  constructor() {
    this.initializeBuiltInTemplates();
  }

  /**
   * Initialize built-in templates for common scenarios
   */
  private initializeBuiltInTemplates(): void {
    // Holiday Templates
    this.addTemplate({
      id: 'major-holiday-minimal',
      name: 'Major Holiday - Minimal Staffing',
      description: 'Minimal essential staffing for major holidays like Christmas, New Year\'s',
      category: 'HOLIDAY',
      tags: ['christmas', 'new-years', 'minimal-staff', 'emergency-only'],
      popularity: 95,
      rating: 4.8,
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 1, emergencyOnly: true },
          isRequired: true,
          description: 'Ensure at least 1 person for emergency coverage'
        },
        {
          constraintType: 'OVERTIME_ALLOWED',
          parameters: { multiplier: 3.0, maxHours: 16 },
          isRequired: false,
          description: 'Triple pay for holiday work'
        }
      ],
      variables: [
        {
          name: 'holidayDate',
          type: 'DATE',
          description: 'Date of the holiday',
          required: true
        },
        {
          name: 'overtimeMultiplier',
          type: 'NUMBER',
          description: 'Overtime pay multiplier',
          defaultValue: 3.0,
          required: false,
          validationRules: { min: 1.5, max: 5.0 }
        }
      ],
      usage: {
        timesUsed: 125,
        lastUsed: new Date('2024-12-25'),
        successRate: 98,
        averageRating: 4.8,
        feedback: []
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        version: '1.2',
        isPublic: true,
        isVerified: true
      }
    });

    this.addTemplate({
      id: 'regular-holiday-reduced',
      name: 'Regular Holiday - Reduced Staffing',
      description: 'Reduced staffing for regular federal holidays',
      category: 'HOLIDAY',
      tags: ['federal-holiday', 'reduced-staff', 'standard'],
      popularity: 78,
      rating: 4.5,
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 2, requiredRoles: ['screener'] },
          isRequired: true,
          description: 'Minimum 2 staff including screener'
        },
        {
          constraintType: 'OVERTIME_ALLOWED',
          parameters: { multiplier: 2.0, maxHours: 12 },
          isRequired: false,
          description: 'Double pay for holiday work'
        }
      ],
      variables: [
        {
          name: 'holidayDate',
          type: 'DATE',
          description: 'Date of the holiday',
          required: true
        },
        {
          name: 'minimumStaff',
          type: 'NUMBER',
          description: 'Minimum number of staff required',
          defaultValue: 2,
          required: false,
          validationRules: { min: 1, max: 5 }
        }
      ],
      usage: {
        timesUsed: 89,
        successRate: 95,
        averageRating: 4.5,
        feedback: []
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        version: '1.1',
        isPublic: true,
        isVerified: true
      }
    });

    // Seasonal Templates
    this.addTemplate({
      id: 'summer-vacation-season',
      name: 'Summer Vacation Season',
      description: 'Handle increased vacation requests during summer months',
      category: 'SEASONAL',
      tags: ['summer', 'vacation', 'june-august', 'coverage'],
      popularity: 65,
      rating: 4.2,
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 3, bufferStaff: 1 },
          isRequired: true,
          description: 'Higher minimum staff due to vacation season'
        },
        {
          constraintType: 'MAX_SCREENER_DAYS',
          parameters: { maxDays: 15, period: 'monthly' },
          isRequired: false,
          description: 'Limit screener days to prevent burnout'
        }
      ],
      variables: [
        {
          name: 'seasonStartDate',
          type: 'DATE',
          description: 'Start of vacation season',
          defaultValue: '2024-06-01',
          required: true
        },
        {
          name: 'seasonEndDate',
          type: 'DATE',
          description: 'End of vacation season',
          defaultValue: '2024-08-31',
          required: true
        },
        {
          name: 'bufferStaff',
          type: 'NUMBER',
          description: 'Additional buffer staff for coverage',
          defaultValue: 1,
          required: false
        }
      ],
      usage: {
        timesUsed: 45,
        successRate: 88,
        averageRating: 4.2,
        feedback: []
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        version: '1.0',
        isPublic: true,
        isVerified: true
      }
    });

    // Maintenance Templates
    this.addTemplate({
      id: 'system-maintenance-monthly',
      name: 'Monthly System Maintenance',
      description: 'Regular system maintenance requiring technical coverage',
      category: 'MAINTENANCE',
      tags: ['maintenance', 'technical', 'monthly', 'night-shift'],
      popularity: 52,
      rating: 4.1,
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 1, requiredSkills: ['technical', 'system_admin'] },
          isRequired: true,
          description: 'Technical staff required for maintenance'
        },
        {
          constraintType: 'PREFERRED_SCREENER',
          parameters: { preferredSkills: ['technical'] },
          isRequired: false,
          description: 'Prefer technical screener during maintenance'
        }
      ],
      variables: [
        {
          name: 'maintenanceDate',
          type: 'DATE',
          description: 'Date of maintenance window',
          required: true
        },
        {
          name: 'requiredSkills',
          type: 'TEXT',
          description: 'Required technical skills (comma-separated)',
          defaultValue: 'technical,system_admin',
          required: false
        },
        {
          name: 'preferNightShift',
          type: 'BOOLEAN',
          description: 'Prefer night shift for maintenance',
          defaultValue: true,
          required: false
        }
      ],
      usage: {
        timesUsed: 38,
        successRate: 92,
        averageRating: 4.1,
        feedback: []
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        version: '1.0',
        isPublic: true,
        isVerified: true
      }
    });

    // Training Templates
    this.addTemplate({
      id: 'mandatory-training-day',
      name: 'Mandatory Training Day',
      description: 'Constraint setup for mandatory training events',
      category: 'TRAINING',
      tags: ['training', 'mandatory', 'skills', 'development'],
      popularity: 34,
      rating: 3.9,
      constraints: [
        {
          constraintType: 'UNAVAILABLE_SCREENER',
          parameters: { reason: 'mandatory_training' },
          isRequired: true,
          description: 'Analysts unavailable during training'
        },
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 1, exemptFromTraining: true },
          isRequired: true,
          description: 'Maintain minimal coverage during training'
        }
      ],
      variables: [
        {
          name: 'trainingDate',
          type: 'DATE',
          description: 'Date of training event',
          required: true
        },
        {
          name: 'trainingParticipants',
          type: 'ANALYST_LIST',
          description: 'Analysts attending training',
          required: true
        },
        {
          name: 'exemptAnalysts',
          type: 'ANALYST_LIST',
          description: 'Analysts exempt from training (for coverage)',
          required: false
        }
      ],
      usage: {
        timesUsed: 23,
        successRate: 85,
        averageRating: 3.9,
        feedback: []
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        version: '1.0',
        isPublic: true,
        isVerified: true
      }
    });

    // Emergency Templates
    this.addTemplate({
      id: 'emergency-response',
      name: 'Emergency Response Protocol',
      description: 'Rapid deployment template for emergency situations',
      category: 'EMERGENCY',
      tags: ['emergency', 'rapid-response', 'critical', 'overtime'],
      popularity: 12,
      rating: 4.7,
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 5, emergencyLevel: 'high' },
          isRequired: true,
          description: 'Increased staffing for emergency response'
        },
        {
          constraintType: 'OVERTIME_ALLOWED',
          parameters: { multiplier: 2.5, maxHours: 20, unlimited: true },
          isRequired: true,
          description: 'Emergency overtime authorization'
        }
      ],
      variables: [
        {
          name: 'emergencyStartDate',
          type: 'DATE',
          description: 'Start of emergency period',
          required: true
        },
        {
          name: 'emergencyEndDate',
          type: 'DATE',
          description: 'Expected end of emergency period',
          required: false
        },
        {
          name: 'emergencyLevel',
          type: 'TEXT',
          description: 'Emergency level (low, medium, high, critical)',
          defaultValue: 'high',
          required: true,
          validationRules: { enum: ['low', 'medium', 'high', 'critical'] }
        },
        {
          name: 'additionalStaff',
          type: 'NUMBER',
          description: 'Additional staff beyond minimum',
          defaultValue: 2,
          required: false
        }
      ],
      usage: {
        timesUsed: 8,
        successRate: 100,
        averageRating: 4.7,
        feedback: []
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        version: '1.0',
        isPublic: true,
        isVerified: true
      }
    });

    console.log(`📚 Initialized ${this.templates.size} built-in constraint templates`);
  }

  /**
   * Add a new template to the library
   */
  addTemplate(template: ConstraintTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get all templates with optional filtering
   */
  getTemplates(filters?: TemplateSearchFilters): ConstraintTemplate[] {
    let templates = Array.from(this.templates.values());

    if (filters) {
      if (filters.category) {
        templates = templates.filter(t => t.category === filters.category);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        templates = templates.filter(t => 
          filters.tags!.some(tag => t.tags.includes(tag))
        );
      }
      
      if (filters.minRating) {
        templates = templates.filter(t => t.rating >= filters.minRating!);
      }
      
      if (filters.createdBy) {
        templates = templates.filter(t => t.metadata.createdBy === filters.createdBy);
      }
      
      if (filters.isPublic !== undefined) {
        templates = templates.filter(t => t.metadata.isPublic === filters.isPublic);
      }
      
      if (filters.isVerified !== undefined) {
        templates = templates.filter(t => t.metadata.isVerified === filters.isVerified);
      }
      
      if (filters.textSearch) {
        const searchLower = filters.textSearch.toLowerCase();
        templates = templates.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
    }

    // Sort by popularity and rating
    return templates.sort((a, b) => {
      const scoreA = (a.popularity * 0.7) + (a.rating * 6); // Weight popularity more
      const scoreB = (b.popularity * 0.7) + (b.rating * 6);
      return scoreB - scoreA;
    });
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): ConstraintTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Apply a template to create actual constraints
   */
  async applyTemplate(application: TemplateApplication): Promise<TemplateApplicationResult> {
    const template = this.templates.get(application.templateId);
    if (!template) {
      throw new Error(`Template ${application.templateId} not found`);
    }

    console.log(`🔧 Applying template: ${template.name}`);

    // Validate variables
    const validationResult = this.validateVariables(template, application.variables);
    if (!validationResult.isValid) {
      throw new Error(`Variable validation failed: ${validationResult.errors.join(', ')}`);
    }

    const result: TemplateApplicationResult = {
      success: true,
      constraintsCreated: 0,
      constraintIds: [],
      errors: [],
      warnings: [],
      preview: [],
      impact: {
        affectedDates: 0,
        affectedAnalysts: 0,
        estimatedConflicts: 0
      }
    };

    // Process each constraint in the template
    for (let i = 0; i < template.constraints.length; i++) {
      const constraintDef = template.constraints[i];
      
      try {
        const constraintData = this.buildConstraintData(constraintDef, application, template);
        
        if (application.previewMode) {
          // Preview mode - just show what would be created
          result.preview!.push({
            constraintType: constraintDef.constraintType,
            description: constraintData.description,
            parameters: constraintData,
            wouldConflict: await this.checkForConflicts(constraintData)
          });
        } else {
          // Actually create the constraint
          const constraint = await prisma.schedulingConstraint.create({
            data: constraintData
          });

          result.constraintIds.push(constraint.id);
          result.constraintsCreated++;

          console.log(`✅ Created constraint: ${constraintDef.constraintType}`);
        }

      } catch (error) {
        console.error(`❌ Failed to create constraint ${i}:`, error);
        
        if (constraintDef.isRequired) {
          result.success = false;
        }

        result.errors.push({
          constraintIndex: i,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: error
        });
      }
    }

    // Calculate impact
    if (!application.previewMode) {
      result.impact = await this.calculateTemplateImpact(application);
    }

    // Update template usage statistics
    if (!application.previewMode && result.success) {
      await this.updateTemplateUsage(application.templateId, result.success);
    }

    return result;
  }

  /**
   * Validate template variables
   */
  private validateVariables(template: ConstraintTemplate, variables: Record<string, any>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = variables[variable.name];

      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable '${variable.name}' is missing`);
        continue;
      }

      // Type validation
      if (value !== undefined && value !== null) {
        const typeValid = this.validateVariableType(variable.type, value);
        if (!typeValid) {
          errors.push(`Variable '${variable.name}' has invalid type. Expected ${variable.type}, got ${typeof value}`);
        }

        // Validation rules
        if (variable.validationRules) {
          const rulesValid = this.validateVariableRules(variable.validationRules, value);
          if (!rulesValid.isValid) {
            errors.push(`Variable '${variable.name}' validation failed: ${rulesValid.error}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate variable type
   */
  private validateVariableType(expectedType: string, value: any): boolean {
    switch (expectedType) {
      case 'DATE':
        return !isNaN(new Date(value).getTime());
      case 'NUMBER':
        return typeof value === 'number' || !isNaN(Number(value));
      case 'TEXT':
        return typeof value === 'string';
      case 'BOOLEAN':
        return typeof value === 'boolean';
      case 'ANALYST_ID':
        return typeof value === 'string' && value.length > 0;
      case 'ANALYST_LIST':
        return Array.isArray(value) && value.every(id => typeof id === 'string');
      default:
        return true;
    }
  }

  /**
   * Validate variable rules
   */
  private validateVariableRules(rules: Record<string, any>, value: any): {
    isValid: boolean;
    error?: string;
  } {
    if (rules.min !== undefined && value < rules.min) {
      return { isValid: false, error: `Value ${value} is below minimum ${rules.min}` };
    }

    if (rules.max !== undefined && value > rules.max) {
      return { isValid: false, error: `Value ${value} is above maximum ${rules.max}` };
    }

    if (rules.enum && !rules.enum.includes(value)) {
      return { isValid: false, error: `Value ${value} is not in allowed values: ${rules.enum.join(', ')}` };
    }

    return { isValid: true };
  }

  /**
   * Build constraint data from template and variables
   */
  private buildConstraintData(
    constraintDef: any,
    application: TemplateApplication,
    template: ConstraintTemplate
  ): any {
    // Start with base constraint data
    const baseData: any = {
      constraintType: constraintDef.constraintType,
      isActive: true,
      description: `${template.name} - ${constraintDef.description}`,
      analystId: null
    };

    // Set dates
    if (application.targetDate) {
      baseData.startDate = application.targetDate;
      baseData.endDate = application.targetDate;
    } else if (application.targetDateRange) {
      baseData.startDate = application.targetDateRange.startDate;
      baseData.endDate = application.targetDateRange.endDate;
    } else if (application.variables.holidayDate || application.variables.trainingDate || application.variables.maintenanceDate) {
      const date = new Date(application.variables.holidayDate || application.variables.trainingDate || application.variables.maintenanceDate);
      baseData.startDate = date;
      baseData.endDate = date;
    }

    // Apply variable substitutions to parameters
    const processedParameters = this.substituteVariables(constraintDef.parameters, application.variables);

    // Merge processed parameters
    return { ...baseData, ...processedParameters };
  }

  /**
   * Substitute variables in constraint parameters
   */
  private substituteVariables(parameters: Record<string, any>, variables: Record<string, any>): Record<string, any> {
    const result = { ...parameters };

    // Simple variable substitution
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const varName = value.slice(2, -1);
        if (variables[varName] !== undefined) {
          result[key] = variables[varName];
        }
      }
    }

    // Apply direct variable overrides
    for (const [varName, varValue] of Object.entries(variables)) {
      if (varName in result) {
        result[varName] = varValue;
      }
    }

    return result;
  }

  /**
   * Check for potential conflicts with existing constraints
   */
  private async checkForConflicts(constraintData: any): Promise<boolean> {
    // Simplified conflict detection
    const existingConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        isActive: true,
        constraintType: constraintData.constraintType,
        startDate: { lte: constraintData.endDate },
        endDate: { gte: constraintData.startDate }
      }
    });

    return existingConstraints.length > 0;
  }

  /**
   * Calculate the impact of applying a template
   */
  private async calculateTemplateImpact(application: TemplateApplication): Promise<any> {
    let affectedDates = 0;
    let affectedAnalysts = 0;

    if (application.targetDate) {
      affectedDates = 1;
    } else if (application.targetDateRange) {
      const start = moment(application.targetDateRange.startDate);
      const end = moment(application.targetDateRange.endDate);
      affectedDates = end.diff(start, 'days') + 1;
    }

    if (application.applicableAnalysts) {
      affectedAnalysts = application.applicableAnalysts.length;
    } else {
      // Get all analysts if not specified
      const analysts = await prisma.analyst.findMany();
      affectedAnalysts = analysts.length;
    }

    return {
      affectedDates,
      affectedAnalysts,
      estimatedConflicts: 0 // Would implement proper conflict estimation
    };
  }

  /**
   * Update template usage statistics
   */
  private async updateTemplateUsage(templateId: string, success: boolean): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) return;

    template.usage.timesUsed++;
    template.usage.lastUsed = new Date();
    
    if (success) {
      // Update success rate
      const totalAttempts = template.usage.timesUsed;
      const successfulAttempts = Math.round(template.usage.successRate * (totalAttempts - 1) / 100) + 1;
      template.usage.successRate = (successfulAttempts / totalAttempts) * 100;
    }

    // Update popularity (usage-based)
    template.popularity = Math.min(template.usage.timesUsed, 100);
  }

  /**
   * Get template categories with counts
   */
  getCategories(): Array<{ category: string; count: number; averageRating: number }> {
    const categoryMap = new Map<string, { count: number; totalRating: number }>();

    for (const template of this.templates.values()) {
      const existing = categoryMap.get(template.category) || { count: 0, totalRating: 0 };
      categoryMap.set(template.category, {
        count: existing.count + 1,
        totalRating: existing.totalRating + template.rating
      });
    }

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      averageRating: data.totalRating / data.count
    }));
  }

  /**
   * Get popular templates
   */
  getPopularTemplates(limit: number = 10): ConstraintTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  /**
   * Get highly rated templates
   */
  getTopRatedTemplates(limit: number = 10): ConstraintTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  /**
   * Search templates by text
   */
  searchTemplates(query: string): ConstraintTemplate[] {
    const searchTerms = query.toLowerCase().split(' ');
    
    return Array.from(this.templates.values()).filter(template => {
      const searchableText = [
        template.name,
        template.description,
        ...template.tags,
        template.category
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  }

  /**
   * Get template statistics
   */
  getLibraryStats(): {
    totalTemplates: number;
    templatesByCategory: Record<string, number>;
    averageRating: number;
    totalUsage: number;
    popularTags: Array<{ tag: string; count: number }>;
  } {
    const templates = Array.from(this.templates.values());
    
    const categoryCount: Record<string, number> = {};
    let totalRating = 0;
    let totalUsage = 0;
    const tagCount: Record<string, number> = {};

    for (const template of templates) {
      categoryCount[template.category] = (categoryCount[template.category] || 0) + 1;
      totalRating += template.rating;
      totalUsage += template.usage.timesUsed;
      
      for (const tag of template.tags) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      }
    }

    const popularTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalTemplates: templates.length,
      templatesByCategory: categoryCount,
      averageRating: totalRating / templates.length,
      totalUsage,
      popularTags
    };
  }

  /**
   * Create custom template from existing constraints
   */
  async createTemplateFromConstraints(
    constraintIds: string[],
    templateData: Partial<ConstraintTemplate>
  ): Promise<string> {
    // Get existing constraints
    const constraints = await prisma.schedulingConstraint.findMany({
      where: { id: { in: constraintIds } }
    });

    if (constraints.length === 0) {
      throw new Error('No constraints found with provided IDs');
    }

    // Convert constraints to template format
    const templateConstraints = constraints.map(constraint => ({
      constraintType: constraint.constraintType,
      parameters: {
        // Extract parameters from constraint description or other fields
        description: constraint.description
      },
      isRequired: true,
      description: constraint.description || `${constraint.constraintType} constraint`
    }));

    // Generate template ID
    const templateId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const template: ConstraintTemplate = {
      id: templateId,
      name: templateData.name || 'Custom Template',
      description: templateData.description || 'Template created from existing constraints',
      category: templateData.category || 'CUSTOM',
      tags: templateData.tags || ['custom'],
      popularity: 0,
      rating: 0,
      constraints: templateConstraints,
      variables: templateData.variables || [
        {
          name: 'targetDate',
          type: 'DATE',
          description: 'Target date for applying constraints',
          required: true
        }
      ],
      usage: {
        timesUsed: 0,
        successRate: 100,
        averageRating: 0,
        feedback: []
      },
      metadata: {
        createdBy: templateData.metadata?.createdBy || 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0',
        isPublic: templateData.metadata?.isPublic || false,
        isVerified: false
      }
    };

    this.addTemplate(template);
    console.log(`📚 Created custom template: ${template.name}`);

    return templateId;
  }

  /**
   * Update template
   */
  updateTemplate(id: string, updates: Partial<ConstraintTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    const updatedTemplate = {
      ...template,
      ...updates,
      metadata: {
        ...template.metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    };

    this.templates.set(id, updatedTemplate);
    return true;
  }

  /**
   * Delete template
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }
}

// Export singleton instance
export const constraintTemplateLibrary = new ConstraintTemplateLibrary();